import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import {
  paymentPathsKey,
  fetchPaymentPaths,
  assetKeyStr,
  type PaymentPath,
  type UsePaymentPathsOptions,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export type { MaybeRefOrGetter } from "vue"

export interface UsePaymentPathsReturn {
  paths: ComputedRef<PaymentPath[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  lastUpdated: ComputedRef<Date | null>
  refetch: () => Promise<void>
}

/**
 * Finds the routes and quotes for converting one asset into another.
 *
 * Results are cached in the shared QueryStore and deduplicated. Use with
 * `usePathPayment` to send or receive a specific amount along a found route.
 *
 * @example
 * const { paths } = usePaymentPaths({
 *   mode: "strictSend",
 *   sourceAsset: "XLM",
 *   sourceAmount: "100",
 *   destinationAsset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
 * })
 */
export function usePaymentPaths(options: MaybeRefOrGetter<UsePaymentPathsOptions>): UsePaymentPathsReturn {
  const runtime = useStellarRuntime()

  const resolvedOptions = computed(() => toValue(options))

  const queryKey = computed(() => {
    const opts = resolvedOptions.value
    const sourceAmount = opts.mode === "strictSend" ? opts.sourceAmount : undefined
    const destinationAmount = opts.mode === "strictReceive" ? opts.destinationAmount : undefined
    const destinationAddress = opts.mode === "strictSend" ? opts.destinationAddress : undefined
    const sourceAddress = opts.mode === "strictReceive" ? opts.sourceAddress : undefined
    const amount = (sourceAmount ?? destinationAmount ?? "") as string
    const addressFilter = destinationAddress ?? sourceAddress

    return paymentPathsKey(
      runtime.networkConfig.horizonUrl,
      runtime.networkConfig.network,
      opts.mode,
      assetKeyStr(opts.sourceAsset),
      assetKeyStr(opts.destinationAsset),
      amount,
      addressFilter
    )
  })

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () => queryKey.value,
    queryFn: () => fetchPaymentPaths(runtime.networkConfig, resolvedOptions.value),
    enabled: () => resolvedOptions.value.enabled !== false,
    staleTime: computed(() => undefined),
  })

  return {
    paths: computed(() => query.data.value?.paths ?? []),
    loading: computed(() => query.loading.value),
    error: computed(() => query.error.value as StellarError | null),
    lastUpdated: computed(() => query.data.value?.lastUpdated ?? null),
    refetch: query.refetch,
  }
}
