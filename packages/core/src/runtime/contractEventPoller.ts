import { SorobanRpc, scValToNative, xdr } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import { onlineManager } from "./onlineManager"
import { focusManager } from "./focusManager"
import type { ContractEvent, StellarError, NetworkConfig } from "../types"

/** How often (ms) to poll the RPC when no interval is given. */
export const DEFAULT_POLL_INTERVAL = 5_000

/** How many events are kept in memory when no bufferSize is given. */
export const DEFAULT_BUFFER_SIZE = 200

/** An SDK/RPC event as it arrives, before decoding. */
interface RpcEvent {
  id: string
  contractId?: unknown
  ledger: number
  ledgerClosedAt: string
  pagingToken: string
  topic?: unknown[]
  value?: unknown
}

/** Options for {@link createContractEventPoller}. */
export interface ContractEventPollerOptions {
  contractIds: string[]
  topics?: string[][]
  /**
   * Ledger to start from. Defaults to the RPC's latest ledger on the first
   * poll, so a fresh subscription reports only what happens from now on.
   */
  startLedger?: number
  /** Polling interval, ms. Non-positive values fall back to {@link DEFAULT_POLL_INTERVAL}. */
  interval?: number
  /** Maximum events retained; oldest are dropped first once full. */
  bufferSize?: number
}

/** Immutable snapshot of the poller's current state. */
export interface ContractEventPollerSnapshot {
  events: ContractEvent[]
  latestLedger: number | null
  loading: boolean
  error: StellarError | null
}

export type ContractEventPollerListener = (snapshot: ContractEventPollerSnapshot) => void

export interface ContractEventPoller {
  /** Begins polling. Idempotent — calling `start()` while already started is a no-op. */
  start: () => void
  /** Stops polling: clears the timer and discards any in-flight poll's result. */
  stop: () => void
  /** Empties the event buffer without stopping or restarting polling. */
  clear: () => void
  /** Registers a listener invoked whenever the snapshot changes. Returns an unsubscribe function. */
  subscribe: (listener: ContractEventPollerListener) => () => void
  /** Returns the current snapshot without subscribing. */
  getSnapshot: () => ContractEventPollerSnapshot
}

/** Renders an ScVal (or an already-encoded string) as base64 XDR. */
function toRawXdr(value: unknown): string {
  if (typeof value === "string") return value

  try {
    return (value as xdr.ScVal).toXDR("base64")
  } catch {
    return ""
  }
}

/** Decodes an ScVal, or an already-encoded base64 string, to a native value. */
function decodeScVal(value: unknown): unknown {
  if (typeof value === "string") {
    return scValToNative(xdr.ScVal.fromXDR(value, "base64"))
  }
  return scValToNative(value as xdr.ScVal)
}

/**
 * Converts one RPC event into a {@link ContractEvent}.
 *
 * Event values are contract-defined, so decoding can fail on a shape the SDK
 * does not know. That is not a reason to throw away the event — the raw XDR is
 * always populated, and a failure is flagged rather than hidden.
 */
function toContractEvent(event: RpcEvent): ContractEvent {
  const rawTopics = (event.topic ?? []).map(toRawXdr)
  const rawValue = toRawXdr(event.value)

  let topics: unknown[] = []
  let value: unknown = null
  let decodeFailed = false

  try {
    topics = (event.topic ?? []).map(decodeScVal)
  } catch {
    decodeFailed = true
  }

  try {
    value = event.value === undefined ? null : decodeScVal(event.value)
  } catch {
    decodeFailed = true
  }

  return {
    id: event.id,
    contractId: String(event.contractId ?? ""),
    ledger: event.ledger,
    ledgerClosedAt: event.ledgerClosedAt,
    topics,
    value,
    raw: { topics: rawTopics, value: rawValue },
    ...(decodeFailed ? { decodeFailed: true } : {}),
  }
}

/**
 * Recognises the RPC's "start ledger is outside the retention window" refusal.
 *
 * Providers word this differently, so several shapes are matched — but only to
 * add guidance, never to change a classification that structured data already
 * settled.
 */
function isRetentionWindowError(message: string): boolean {
  const lower = message.toLowerCase()

  return (
    (lower.includes("ledger") &&
      (lower.includes("retention") ||
        lower.includes("not available") ||
        lower.includes("must be within") ||
        lower.includes("is before") ||
        lower.includes("older than"))) ||
    lower.includes("start ledger")
  )
}

/**
 * Framework-neutral Soroban contract-event poller, extracted from
 * `useContractEvents`.
 *
 * Owns its own timer and RPC calls. `stop()` clears the timer and guards
 * against a late in-flight result publishing into a stopped poller — the
 * race where a request starts, `stop()` is called, and the RPC resolves
 * afterwards. `clear()` empties the buffer without touching the timer or
 * cursor, matching the original hook's `clear` semantics.
 */
export function createContractEventPoller(
  networkConfig: Pick<NetworkConfig, "sorobanUrl">,
  options: ContractEventPollerOptions
): ContractEventPoller {
  const { sorobanUrl } = networkConfig
  const { contractIds, topics, startLedger, bufferSize = DEFAULT_BUFFER_SIZE } = options
  const intervalMs =
    options.interval && options.interval > 0 ? options.interval : DEFAULT_POLL_INTERVAL

  let events: ContractEvent[] = []
  let latestLedger: number | null = null
  let loading = false
  let error: StellarError | null = null

  let cursor: string | null = null
  const seen = new Set<string>()

  let timer: ReturnType<typeof setInterval> | null = null
  let onlineUnsubscribe: (() => void) | null = null
  let focusUnsubscribe: (() => void) | null = null
  let running = false
  // Monotonic id used to drop out-of-order or post-stop responses.
  let requestId = 0

  const listeners = new Set<ContractEventPollerListener>()

  function snapshot(): ContractEventPollerSnapshot {
    return { events, latestLedger, loading, error }
  }

  function emit(): void {
    const s = snapshot()
    for (const listener of listeners) {
      listener(s)
    }
  }

  async function poll(): Promise<void> {
    if (!running) return
    if (contractIds.length === 0) return
    // Offline, a poll can only fail. Skip it and keep the events already
    // delivered; the cursor is untouched, so reconnecting resumes from it.
    if (!onlineManager.isOnline()) return

    const fetchId = ++requestId
    loading = true
    emit()

    try {
      const server = new SorobanRpc.Server(sorobanUrl, {
        allowHttp: sorobanUrl.startsWith("http://"),
      })

      const filter: SorobanRpc.Api.EventFilter = {
        type: "contract",
        contractIds,
        ...(topics ? { topics } : {}),
      }

      // `cursor` and `startLedger` are mutually exclusive: the first call
      // anchors the range, every later call continues from the cursor.
      const request = cursor
        ? { filters: [filter], cursor }
        : {
            filters: [filter],
            startLedger: startLedger ?? (await server.getLatestLedger()).sequence,
          }

      const response = await server.getEvents(request)

      // Guard: `stop()` may have been called while this request was in
      // flight, or a newer poll may have already started. A late result must
      // never publish into a poller that is no longer running.
      if (fetchId !== requestId || !running) return

      const incoming = (response.events ?? []) as unknown as RpcEvent[]

      // Advance the cursor even when nothing matched, so an idle contract does
      // not re-scan the same ledgers forever.
      const lastToken = incoming[incoming.length - 1]?.pagingToken
      if (lastToken) cursor = lastToken

      latestLedger = response.latestLedger ?? null
      error = null

      const fresh = incoming.filter(event => !seen.has(event.id))
      if (fresh.length > 0) {
        fresh.forEach(event => seen.add(event.id))

        const next = [...events, ...fresh.map(toContractEvent)]
        // Bounded buffer: the oldest events are dropped once it is full.
        events = next.length > bufferSize ? next.slice(next.length - bufferSize) : next
      }
    } catch (err) {
      if (fetchId !== requestId || !running) return
      // The connection dropped mid-poll — not an error worth surfacing.
      if (!onlineManager.isOnline()) return

      const message = err instanceof Error ? err.message : String(err)

      error = isRetentionWindowError(message)
        ? createStellarError(
            "LEDGER_OUT_OF_RETENTION",
            `The RPC server refused this ledger range: ${message}. ` +
              "RPC providers retain a limited window of ledgers — typically around 24 hours. " +
              "Request a more recent startLedger, or use an archival RPC provider for older history.",
            { raw: err }
          )
        : toStellarError(err)
    } finally {
      if (fetchId === requestId && running) {
        loading = false
      }
      emit()
    }
  }

  function start(): void {
    if (running) return
    running = true
    void poll()
    
    // Set up polling interval, respecting focus state
    const startTimer = () => {
      if (!focusManager.isFocused()) return
      timer = setInterval(() => {
        if (!focusManager.isFocused()) return
        void poll()
      }, intervalMs)
    }
    
    startTimer()
    
    // Catch up once on reconnect rather than waiting out the interval.
    onlineUnsubscribe = onlineManager.subscribe(online => {
      if (online) void poll()
    })
    
    // Pause polling when backgrounded, resume on foreground with one immediate poll
    focusUnsubscribe = focusManager.subscribe(focused => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      if (!focused) return
      // On foreground: run one immediate poll and resume interval
      void poll()
      startTimer()
    })
  }

  function stop(): void {
    if (!running) return
    running = false
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    if (onlineUnsubscribe) {
      onlineUnsubscribe()
      onlineUnsubscribe = null
    }
    if (focusUnsubscribe) {
      focusUnsubscribe()
      focusUnsubscribe = null
    }
    // Invalidate any in-flight poll so its result cannot publish late.
    requestId += 1
    loading = false
    emit()
  }

  function clear(): void {
    events = []
    emit()
  }

  function subscribe(listener: ContractEventPollerListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    start,
    stop,
    clear,
    subscribe,
    getSnapshot: snapshot,
  }
}
