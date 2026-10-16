import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type ShallowRef,
} from "vue"
import {
  createContractEventPoller,
  DEFAULT_BUFFER_SIZE,
  DEFAULT_POLL_INTERVAL,
  type ContractEvent,
  type ContractEventPoller,
  type StellarError,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"
import type { MaybeRefOrGetter } from "./useBalance"

export interface UseContractEventsOptions {
  contractIds: MaybeRefOrGetter<readonly string[]>
  topics?: MaybeRefOrGetter<readonly (readonly string[])[] | undefined>
  startLedger?: MaybeRefOrGetter<number | undefined>
  interval?: MaybeRefOrGetter<number | undefined>
  bufferSize?: MaybeRefOrGetter<number | undefined>
  enabled?: MaybeRefOrGetter<boolean | undefined>
}

export interface UseContractEventsReturn {
  events: ShallowRef<ContractEvent[]>
  latestLedger: ComputedRef<number | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  clear: () => void
}

/**
 * Polls Soroban contract events through the framework-neutral core poller and
 * binds its lifetime to the current Vue effect scope.
 */
export function useContractEvents(options: UseContractEventsOptions): UseContractEventsReturn {
  const { networkConfig } = useStellarRuntime()
  const events = shallowRef<ContractEvent[]>([])
  const latestLedgerState = ref<number | null>(null)
  const loadingState = ref(false)
  const errorState = shallowRef<StellarError | null>(null)
  let activePoller: ContractEventPoller | null = null
  let activeUnsubscribe: (() => void) | null = null

  const input = computed(() => {
    const contractIds = [...toValue(options.contractIds)]
    const rawTopics = options.topics === undefined ? undefined : toValue(options.topics)
    const topics = rawTopics?.map(topic => [...topic])

    return {
      contractIds,
      contractKey: JSON.stringify(contractIds),
      topics,
      topicKey: JSON.stringify(topics ?? []),
      startLedger: options.startLedger === undefined ? undefined : toValue(options.startLedger),
      interval:
        (options.interval === undefined ? undefined : toValue(options.interval)) ??
        DEFAULT_POLL_INTERVAL,
      bufferSize:
        (options.bufferSize === undefined ? undefined : toValue(options.bufferSize)) ??
        DEFAULT_BUFFER_SIZE,
      enabled: (options.enabled === undefined ? undefined : toValue(options.enabled)) ?? true,
    }
  })

  function stopActivePoller(): void {
    activeUnsubscribe?.()
    activeUnsubscribe = null
    activePoller?.stop()
    activePoller = null
  }

  watch(
    () =>
      [
        input.value.contractKey,
        input.value.topicKey,
        input.value.startLedger,
        input.value.interval,
        input.value.bufferSize,
        input.value.enabled,
      ] as const,
    () => {
      stopActivePoller()
      const current = input.value

      if (!current.enabled || current.contractIds.length === 0) {
        events.value = []
        latestLedgerState.value = null
        loadingState.value = false
        errorState.value = null
        return
      }

      const poller = createContractEventPoller(
        { sorobanUrl: networkConfig.sorobanUrl },
        {
          contractIds: current.contractIds,
          topics: current.topics,
          startLedger: current.startLedger,
          interval: current.interval,
          bufferSize: current.bufferSize,
        }
      )
      activePoller = poller
      activeUnsubscribe = poller.subscribe(snapshot => {
        events.value = snapshot.events
        latestLedgerState.value = snapshot.latestLedger
        loadingState.value = snapshot.loading
        errorState.value = snapshot.error
      })
      poller.start()
    },
    { immediate: true }
  )

  onScopeDispose(stopActivePoller)

  const latestLedger = computed(() => latestLedgerState.value)
  const loading = computed(() => loadingState.value)
  const error = computed(() => errorState.value)

  function clear(): void {
    activePoller?.clear()
  }

  return { events, latestLedger, loading, error, clear }
}
