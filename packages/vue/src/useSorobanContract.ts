import { computed, toRaw, toValue, type ComputedRef } from "vue"
import {
  ANONYMOUS_SIMULATION_SOURCE,
  argsKey,
  simulateContractCall,
  sorobanContractKey,
  toStellarError,
  type ContractSpecLike,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
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

  // The call the inputs currently describe, or null while contract or method
  // is missing. Unwrapped from Vue proxies, so the SDK sees plain values.
  const call = computed<ResolvedCall | null>(() => {
    const contractId = toValue(options.contractId)?.trim() ?? ""
    const method = toValue(options.method)?.trim() ?? ""
    if (!contractId || !method) return null

    const spec = options.spec === undefined ? undefined : toValue(options.spec)
    const sourceAccount =
      (options.sourceAccount === undefined ? undefined : toValue(options.sourceAccount))?.trim() ||
      ANONYMOUS_SIMULATION_SOURCE

    return {
      contractId,
      method,
      args: unwrapArgs(options.args === undefined ? [] : toValue(options.args)),
      spec: spec ? toRaw(spec as ContractSpecLike) : undefined,
      sourceAccount,
    }
  })

  const query = useQuery<T>({
    store: queryStore,
    queryKey: () => {
      const current = call.value
      if (!current) return ["soroban", "disabled"]
      return sorobanContractKey(
        networkConfig.sorobanUrl,
        networkConfig.network,
        current.contractId,
        current.method,
        argsKey(current.args),
        current.sourceAccount,
        current.spec ? "spec" : "raw"
      )
    },
    queryFn: () => simulateContractCall<T>(networkConfig, call.value!),
    enabled: () => call.value !== null,
    staleTime: options.staleTime,
  })

  return {
    data: computed(() => query.data.value),
    loading: computed(() => query.loading.value),
    error: computed<StellarError | null>(() =>
      query.error.value ? toStellarError(query.error.value) : null
    ),
    refetch: () => {
      void query.refetch()
    },
  }
}
