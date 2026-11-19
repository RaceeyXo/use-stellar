import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import {
  claimableBalanceKey,
  fetchClaimableBalances,
  type ClaimableBalance,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UseClaimableBalanceOptions {
  address?: MaybeRefOrGetter<string | null | undefined>
  staleTime?: MaybeRefOrGetter<number | undefined>
}

export interface UseClaimableBalanceReturn {
  balances: ComputedRef<ClaimableBalance[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}

export function useClaimableBalance(
  options: UseClaimableBalanceOptions = {}
): UseClaimableBalanceReturn {
  const runtime = useStellarRuntime()
  const address = computed(() => {
    const value =
      options.address === undefined ? runtime.walletAddress.value : toValue(options.address)
    return value?.trim() || null
  })
  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      claimableBalanceKey(
        runtime.networkConfig.horizonUrl,
        runtime.networkConfig.network,
        address.value ?? ""
      ),
    queryFn: () => fetchClaimableBalances(runtime.networkConfig, { address: address.value! }),
    enabled: () => address.value !== null,
    staleTime: options.staleTime,
  })

  return {
    balances: computed(() => query.data.value ?? []),
    loading: computed(() => query.loading.value),
    error: computed(() => query.error.value as StellarError | null),
    refetch: query.refetch,
  }
}
