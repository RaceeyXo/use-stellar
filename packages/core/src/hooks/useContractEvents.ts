import { useState, useEffect, useCallback, useRef } from "react"
import { SorobanRpc, scValToNative, xdr } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { createStellarError, toStellarError } from "../errors"
import type {
  ContractEvent,
  StellarError,
  UseContractEventsOptions,
  UseContractEventsReturn,
} from "../types"

/** How often (ms) to poll the RPC when no interval is given. */
const DEFAULT_INTERVAL = 5_000

/** How many events are kept in memory when no bufferSize is given. */
const DEFAULT_BUFFER_SIZE = 200

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
 * Subscribes to the events a Soroban contract emits.
 *
 * Events are how a UI reacts to contract state changes without polling
 * contract storage: a token contract emits `transfer`, a DEX emits `swap`, and
 * the event carries *what changed* rather than only that something did.
 *
 * Unlike Horizon payments there is no streaming endpoint, so this polls the
 * RPC's `getEvents` and advances a cursor between calls. The cursor is what
 * stops the same events arriving on every poll.
 *
 * **Retention.** RPC providers keep a limited ledger window, typically around
 * 24 hours. A `startLedger` older than that is refused by the server — it is
 * an error, not an empty result, and it surfaces as
 * `LEDGER_OUT_OF_RETENTION` with guidance to use an archival provider.
 *
 * **Buffering.** At most `bufferSize` events are kept (default 200). When the
 * buffer is full the oldest are dropped, so a busy contract cannot grow this
 * array without limit. Raise `bufferSize` if you need deeper history, or
 * persist events yourself as they arrive.
 *
 * @example
 * const { events, latestLedger } = useContractEvents({
 *   contractIds: ["CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"],
 * })
 */
export function useContractEvents({
  contractIds,
  topics,
  startLedger,
  interval = DEFAULT_INTERVAL,
  bufferSize = DEFAULT_BUFFER_SIZE,
  enabled = true,
}: UseContractEventsOptions): UseContractEventsReturn {
  const { networkConfig } = useStellarContext()
  const { sorobanUrl } = networkConfig

  const [events, setEvents] = useState<ContractEvent[]>([])
  const [latestLedger, setLatestLedger] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  // The paging token from the last response. Polling from here rather than
  // from `startLedger` is what prevents duplicates on every poll.
  const cursorRef = useRef<string | null>(null)
  // Ids already delivered, as a second line of defence if a provider replays
  // an event at a cursor boundary.
  const seenRef = useRef<Set<string>>(new Set())
  // Monotonic id used to drop out-of-order responses and any that land after
  // unmount.
  const requestRef = useRef(0)
  const mountedRef = useRef(true)

  // `contractIds` and `topics` are almost always inline array literals — a new
  // array on every render. Depending on the arrays themselves would tear down
  // and rebuild the subscription each time, which is the failure mode bug-01
  // documents. Depend on a stable serialization instead.
  const contractKey = contractIds.join(",")
  const topicKey = topics ? JSON.stringify(topics) : ""

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // A change of filter is a different subscription, so the cursor and the
  // dedupe set start over.
  useEffect(() => {
    cursorRef.current = null
    seenRef.current = new Set()
  }, [contractKey, topicKey, startLedger])

  const poll = useCallback(async () => {
    if (!enabled) return

    const ids = contractKey ? contractKey.split(",") : []
    if (ids.length === 0) return

    const fetchId = ++requestRef.current
    setLoading(true)

    try {
      const server = new SorobanRpc.Server(sorobanUrl, {
        allowHttp: sorobanUrl.startsWith("http://"),
      })

      const filter: SorobanRpc.Api.EventFilter = {
        type: "contract",
        contractIds: ids,
        ...(topics ? { topics } : {}),
      }

      // `cursor` and `startLedger` are mutually exclusive: the first call
      // anchors the range, every later call continues from the cursor.
      const request = cursorRef.current
        ? { filters: [filter], cursor: cursorRef.current }
        : {
            filters: [filter],
            startLedger: startLedger ?? (await server.getLatestLedger()).sequence,
          }

      const response = await server.getEvents(request)

      if (fetchId !== requestRef.current || !mountedRef.current) return

      const incoming = (response.events ?? []) as unknown as RpcEvent[]

      // Advance the cursor even when nothing matched, so an idle contract does
      // not re-scan the same ledgers forever.
      const lastToken = incoming[incoming.length - 1]?.pagingToken
      if (lastToken) cursorRef.current = lastToken

      setLatestLedger(response.latestLedger ?? null)
      setError(null)

      const fresh = incoming.filter(event => !seenRef.current.has(event.id))
      if (fresh.length > 0) {
        fresh.forEach(event => seenRef.current.add(event.id))

        setEvents(previous => {
          const next = [...previous, ...fresh.map(toContractEvent)]
          // Bounded buffer: the oldest events are dropped once it is full.
          return next.length > bufferSize ? next.slice(next.length - bufferSize) : next
        })
      }
    } catch (err) {
      if (fetchId !== requestRef.current || !mountedRef.current) return

      const message = err instanceof Error ? err.message : String(err)

      setError(
        isRetentionWindowError(message)
          ? createStellarError(
              "LEDGER_OUT_OF_RETENTION",
              `The RPC server refused this ledger range: ${message}. ` +
                "RPC providers retain a limited window of ledgers — typically around 24 hours. " +
                "Request a more recent startLedger, or use an archival RPC provider for older history.",
              { raw: err }
            )
          : toStellarError(err)
      )
    } finally {
      if (fetchId === requestRef.current && mountedRef.current) {
        setLoading(false)
      }
    }
    // `contractIds` and `topics` are covered by their serialized keys above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- topics is represented by topicKey to avoid inline-array resubscriptions.
  }, [enabled, contractKey, topicKey, startLedger, sorobanUrl, bufferSize])

  useEffect(() => {
    if (!enabled) {
      // Disabled means disabled: no request, no timer.
      return
    }

    poll()

    // Guard against non-positive intervals that would busy-loop setInterval.
    const ms = interval > 0 ? interval : DEFAULT_INTERVAL
    const id = setInterval(poll, ms)

    return () => {
      clearInterval(id)
      // Cancel any in-flight poll so a late response cannot update an
      // unmounted component or a stale subscription.
      requestRef.current = -1
    }
  }, [poll, enabled, interval])

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  return { events, latestLedger, loading, error, clear }
}
