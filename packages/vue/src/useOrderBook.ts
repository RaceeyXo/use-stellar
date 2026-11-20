import { computed, onScopeDispose, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import { fetchOrderBook, orderBookKey, type Asset, type OrderBookResult, type StellarError } from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UseOrderBookOptions { selling: MaybeRefOrGetter<Asset>; buying: MaybeRefOrGetter<Asset>; limit?: MaybeRefOrGetter<number | undefined>; watch?: MaybeRefOrGetter<boolean | undefined>; interval?: MaybeRefOrGetter<number | undefined>; enabled?: MaybeRefOrGetter<boolean | undefined> }
export interface UseOrderBookReturn { data: ComputedRef<OrderBookResult | null>; bids: ComputedRef<OrderBookResult["bids"]>; asks: ComputedRef<OrderBookResult["asks"]>; loading: ComputedRef<boolean>; error: ComputedRef<StellarError | null>; refetch: () => Promise<void> }

export function useOrderBook(options: UseOrderBookOptions): UseOrderBookReturn {
  const runtime = useStellarRuntime()
  const selling = computed(() => toValue(options.selling))
  const buying = computed(() => toValue(options.buying))
  const limit = computed(() => toValue(options.limit) ?? 20)
  const query = useQuery<OrderBookResult>({ store: runtime.queryStore, queryKey: () => orderBookKey(runtime.networkConfig.horizonUrl, runtime.network, selling.value, buying.value, limit.value), queryFn: () => fetchOrderBook(runtime.networkConfig, { selling: selling.value, buying: buying.value, limit: limit.value }), enabled: () => toValue(options.enabled) ?? true })
  let timer: ReturnType<typeof setInterval> | null = null
  if (typeof window !== "undefined" && (toValue(options.watch) ?? false)) timer = setInterval(query.refetch, toValue(options.interval) ?? 5000)
  onScopeDispose(() => { if (timer) clearInterval(timer) })
  return { data: computed(() => query.data.value), bids: computed(() => query.data.value?.bids ?? []), asks: computed(() => query.data.value?.asks ?? []), loading: computed(() => query.loading.value), error: computed(() => query.error.value as StellarError | null), refetch: query.refetch }
}
