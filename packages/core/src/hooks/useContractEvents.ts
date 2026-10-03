import { useState, useEffect, useCallback, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import {
  createContractEventPoller,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_BUFFER_SIZE,
  type ContractEventPoller,
} from "../runtime/contractEventPoller"
import type {
  ContractEvent,
  StellarError,
  UseContractEventsOptions,
  UseContractEventsReturn,
} from "../types"

/**
 * Subscribes to the events a Soroban contract emits.
 *
 * Events are how a UI reacts to contract state changes without polling
 * contract storage: a token contract emits `transfer`, a DEX emits `swap`, and
 * the event carries *what changed* rather than only that something did.
 *
 * Unlike Horizon payments there is no streaming endpoint, so the shared
 * {@link createContractEventPoller} polls the RPC's `getEvents` and advances a
 * cursor between calls. This hook is a thin React adapter over that poller:
 * all polling, cursor tracking, decoding, and buffering logic lives there.
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
  interval = DEFAULT_POLL_INTERVAL,
  bufferSize = DEFAULT_BUFFER_SIZE,
  enabled = true,
}: UseContractEventsOptions): UseContractEventsReturn {
  const { networkConfig } = useStellarContext()
  const { sorobanUrl } = networkConfig

  const [events, setEvents] = useState<ContractEvent[]>([])
  const [latestLedger, setLatestLedger] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  const pollerRef = useRef<ContractEventPoller | null>(null)

  // `contractIds` and `topics` are almost always inline array literals — a new
  // array on every render. Depending on the arrays themselves would tear down
  // and rebuild the subscription each time, which is the failure mode bug-01
  // documents. Depend on a stable serialization instead.
  const contractKey = contractIds.join(",")
  const topicKey = topics ? JSON.stringify(topics) : ""

  useEffect(() => {
    if (!enabled) {
      // Disabled means disabled: no request, no timer.
      return
    }

    const ids = contractKey ? contractKey.split(",") : []
    if (ids.length === 0) return

    const poller = createContractEventPoller(
      { sorobanUrl },
      { contractIds: ids, topics, startLedger, interval, bufferSize }
    )
    pollerRef.current = poller

    const unsubscribe = poller.subscribe(snapshot => {
      setEvents(snapshot.events)
      setLatestLedger(snapshot.latestLedger)
      setLoading(snapshot.loading)
      setError(snapshot.error)
    })

    poller.start()

    return () => {
      unsubscribe()
      poller.stop()
      pollerRef.current = null
    }
    // `contractIds` and `topics` are covered by their serialized keys above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- topics is represented by topicKey to avoid inline-array resubscriptions.
  }, [enabled, contractKey, topicKey, startLedger, sorobanUrl, interval, bufferSize])

  const clear = useCallback(() => {
    // The poller's `clear()` emits its own snapshot synchronously to the
    // subscriber above, which updates `events` — no separate setState needed
    // here. When disabled (no poller instance), there is nothing to clear.
    pollerRef.current?.clear()
  }, [])

  return { events, latestLedger, loading, error, clear }
}
