import { computed, ref, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue"
import { fetchOffersPage, normalizeOffer, offersKey, toStellarError, type NormalizedOffer, type OffersPageResult, type StellarError } from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UseOffersOptions { address?: MaybeRefOrGetter<string | null | undefined>; limit?: MaybeRefOrGetter<number | undefined>; order?: MaybeRefOrGetter<"asc" | "desc" | undefined>; cursor?: MaybeRefOrGetter<string | undefined> }
export interface UseOffersReturn { offers: ComputedRef<NormalizedOffer[]>; loading: ComputedRef<boolean>; error: ComputedRef<StellarError | null>; refetch: () => Promise<void>; fetchNext: () => Promise<void>; fetchPrev: () => Promise<void>; hasNext: ComputedRef<boolean>; hasPrev: ComputedRef<boolean> }

export function useOffers(options: UseOffersOptions = {}): UseOffersReturn {
  const runtime = useStellarRuntime()
  const address = computed(() => (options.address === undefined ? runtime.walletAddress.value : toValue(options.address))?.trim() || null)
  const limit = computed(() => toValue(options.limit) ?? 10)
  const order = computed(() => toValue(options.order) ?? "desc")
  const cursor = computed(() => toValue(options.cursor))
  const query = useQuery<OffersPageResult>({ store: runtime.queryStore, queryKey: () => address.value ? offersKey(runtime.networkConfig.horizonUrl, runtime.network, address.value, limit.value, order.value, cursor.value) : ["offers", "disabled"], queryFn: () => fetchOffersPage(runtime.networkConfig, { address: address.value!, limit: limit.value, order: order.value, cursor: cursor.value }), enabled: () => Boolean(address.value) })
  const displayed = shallowRef<NormalizedOffer[]>([])
  const page = shallowRef<OffersPageResult | null>(null)
  const pageLoading = ref(false)
  const pageError = shallowRef<StellarError | null>(null)
  watch(query.data, value => { page.value = value; displayed.value = value?.offers ?? []; pageError.value = null }, { immediate: true })
  async function navigate(direction: "next" | "prev") {
    if (!page.value) return
    pageLoading.value = true
    try {
      const response = await page.value[direction]()
      const offers = response.records.map(normalizeOffer)
      displayed.value = offers
      page.value = { offers, next: () => response.next(), prev: () => response.prev(), hasNext: direction === "next" ? response.records.length >= limit.value : true, hasPrev: direction === "prev" ? response.records.length >= limit.value : true }
    } catch (cause) { pageError.value = toStellarError(cause) }
    finally { pageLoading.value = false }
  }
  return { offers: computed(() => displayed.value), loading: computed(() => query.loading.value || pageLoading.value), error: computed(() => pageError.value ?? query.error.value as StellarError | null), refetch: query.refetch, fetchNext: () => navigate("next"), fetchPrev: () => navigate("prev"), hasNext: computed(() => page.value?.hasNext ?? false), hasPrev: computed(() => page.value?.hasPrev ?? false) }
}
