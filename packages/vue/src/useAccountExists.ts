import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import {
  accountKey,
  fetchAccountExists,
  isValidStellarAddress,
  toStellarError,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export type AccountExistsReason = "exists" | "not_funded" | "invalid_format" | "idle"

export interface UseAccountExistsOptions {
  /** Omitted: the connected wallet. `null` or `""` keeps the composable idle. */
  address?: MaybeRefOrGetter<string | null | undefined>
  staleTime?: MaybeRefOrGetter<number | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UseAccountExistsReturn {
  exists: ComputedRef<boolean | null>
  reason: ComputedRef<AccountExistsReason>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}

/**
 * Whether an address is funded. A missing account is `exists: false`, not an error.
 * Shares `accountKey` with the React hook.
 */
export function useAccountExists(options: UseAccountExistsOptions = {}): UseAccountExistsReturn {
  const runtime = useStellarRuntime()
  const address = computed(() => {
    const value =
      options.address === undefined ? runtime.walletAddress.value : toValue(options.address)
    return value?.trim() || null
  })
  const formatValid = computed(() => !address.value || isValidStellarAddress(address.value))

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      address.value && formatValid.value
        ? accountKey(
            runtime.networkConfig.horizonUrl,
            runtime.networkConfig.network,
            address.value
          )
        : (["accountExists", "disabled"] as const),
    queryFn: () => fetchAccountExists(runtime.networkConfig, { address: address.value! }),
    enabled: () => address.value !== null && formatValid.value,
    staleTime: options.staleTime,
    maxRetries: options.maxRetries,
  })

  return {
    exists: computed(() => {
      if (!address.value) return null
      if (!formatValid.value) return false
      return query.data.value?.exists ?? null
    }),
    reason: computed(() => {
      if (!address.value) return "idle"
      if (!formatValid.value) return "invalid_format"
      return query.data.value?.reason ?? "idle"
    }),
    loading: computed(() => (address.value && formatValid.value ? query.loading.value : false)),
    error: computed(() => {
      if (!address.value || !formatValid.value) return null
      return query.error.value ? toStellarError(query.error.value) : null
    }),
    refetch: query.refetch,
  }
}
