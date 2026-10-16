import { computed, ref, toRaw, toValue, watch, type ComputedRef } from "vue"
import {
  ANONYMOUS_SIMULATION_SOURCE,
  argsKey,
  serializeKey,
  simulateContractCall,
  sorobanContractKey,
  toStellarError,
  type ContractSpecLike,
  type StellarError,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"
import type { MaybeRefOrGetter } from "./useBalance"

export { ANONYMOUS_SIMULATION_SOURCE }

export interface UseSorobanContractOptions {
  contractId: MaybeRefOrGetter<string | null | undefined>
  method: MaybeRefOrGetter<string | null | undefined>
  args?: MaybeRefOrGetter<readonly unknown[] | null | undefined>
  spec?: MaybeRefOrGetter<ContractSpecLike | null | undefined>
  sourceAccount?: MaybeRefOrGetter<string | null | undefined>
  staleTime?: number
}

export interface UseSorobanContractReturn<T = unknown> {
  data: ComputedRef<T | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => void
}

interface ResolvedCall {
  contractId: string
  method: string
  args: unknown[]
  spec?: ContractSpecLike
  sourceAccount: string
}

function unwrapArgs(value: readonly unknown[] | null | undefined): unknown[] {
  if (!value) return []
  const raw = toRaw(value)
  return raw.map(argument =>
    argument !== null && typeof argument === "object" ? toRaw(argument) : argument
  )
}

/**
 * Simulates a read-only Soroban contract call through the shared core query.
 * Every input may be static or reactive; cache identity follows the canonical
 * serialized arguments rather than Vue proxy identity.
 */
export function useSorobanContract<T = unknown>(
  options: UseSorobanContractOptions
): UseSorobanContractReturn<T> {
  const { networkConfig, queryStore } = useStellarRuntime()
  const currentKey = ref<string | null>(null)
  let currentCall: ResolvedCall | null = null

  const run = (key: string, call: ResolvedCall, force = false): Promise<T> =>
    queryStore.run<T>(key, () => simulateContractCall<T>(networkConfig, call), {
      staleTime: options.staleTime,
      force,
    })

  const input = computed(() => ({
    contractId: toValue(options.contractId)?.trim() ?? "",
    method: toValue(options.method)?.trim() ?? "",
    args: options.args === undefined ? [] : toValue(options.args),
    spec: options.spec === undefined ? undefined : toValue(options.spec),
    sourceAccount: options.sourceAccount === undefined ? undefined : toValue(options.sourceAccount),
  }))

  watch(
    input,
    (
      { contractId, method, args: inputArgs, spec: inputSpec, sourceAccount: inputSource },
      _,
      onCleanup
    ) => {
      if (!contractId || !method) {
        currentKey.value = null
        currentCall = null
        return
      }

      const args = unwrapArgs(inputArgs)
      const spec = inputSpec ? toRaw(inputSpec as ContractSpecLike) : undefined
      const sourceAccount = inputSource?.trim() || ANONYMOUS_SIMULATION_SOURCE

      const call: ResolvedCall = { contractId, method, args, spec, sourceAccount }
      const key = serializeKey(
        sorobanContractKey(
          networkConfig.sorobanUrl,
          networkConfig.network,
          contractId,
          method,
          argsKey(args),
          sourceAccount,
          spec ? "spec" : "raw"
        )
      )

      currentKey.value = key
      currentCall = call
      const unsubscribe = queryStore.subscribe(key)
      run(key, call).catch(() => {})
      onCleanup(unsubscribe)
    },
    { immediate: true }
  )

  const entry = computed(() => (currentKey.value ? queryStore.getEntry<T>(currentKey.value) : null))
  const data = computed<T | null>(() => entry.value?.data ?? null)
  const loading = computed(() => entry.value?.loading ?? false)
  const error = computed<StellarError | null>(() => {
    const rawError = entry.value?.error
    return rawError ? toStellarError(rawError) : null
  })

  function refetch(): void {
    if (!currentKey.value || !currentCall) return
    run(currentKey.value, currentCall, true).catch(() => {})
  }

  return { data, loading, error, refetch }
}
