import {
  computed,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue"
import {
  fetchPaymentsPage,
  normalizePayment,
  paymentsKey,
  serializeKey,
  toStellarError,
  type NormalizedPayment,
  type PaymentsPageResult,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UsePaymentsOptions {
  address?: MaybeRefOrGetter<string | null | undefined>
  limit?: MaybeRefOrGetter<number | undefined>
  order?: MaybeRefOrGetter<"asc" | "desc" | undefined>
  cursor?: MaybeRefOrGetter<string | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UsePaymentsReturn {
  payments: ComputedRef<NormalizedPayment[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  isStale: ComputedRef<boolean>
  refetch: () => Promise<void>
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: ComputedRef<boolean>
  hasPrev: ComputedRef<boolean>
}

export function usePayments(options: UsePaymentsOptions = {}): UsePaymentsReturn {
  const runtime = useStellarRuntime()
  const address = computed(() => {
    const value =
      options.address === undefined ? runtime.walletAddress.value : toValue(options.address)
    return value?.trim() || null
  })
  const limit = computed(() => toValue(options.limit) ?? 10)
  const order = computed(() => toValue(options.order) ?? "desc")
  const inputCursor = computed(() => toValue(options.cursor))
  const activeCursor = ref<string | undefined>(inputCursor.value)

  watch(inputCursor, cursor => (activeCursor.value = cursor), { flush: "sync" })
  watch(
    [address, limit, order],
    (_next, previous) => {
      if (previous.length > 0) activeCursor.value = undefined
    },
    { flush: "sync" }
  )

  const queryKey = computed(() =>
    address.value
      ? paymentsKey(
          runtime.networkConfig.horizonUrl,
          runtime.networkConfig.network,
          address.value,
          limit.value,
          order.value,
          activeCursor.value
        )
      : (["payments", "disabled"] as const)
  )
  const query = useQuery<PaymentsPageResult>({
    store: runtime.queryStore,
    queryKey: () => queryKey.value,
    queryFn: () =>
      fetchPaymentsPage(runtime.networkConfig, {
        address: address.value!,
        limit: limit.value,
        order: order.value,
        cursor: activeCursor.value,
      }),
    enabled: () => address.value !== null,
    maxRetries: options.maxRetries,
  })

  const displayed = shallowRef<NormalizedPayment[]>([])
  const nextPage = shallowRef<PaymentsPageResult["nextCursor"] | null>(null)
  const prevPage = shallowRef<PaymentsPageResult["prevCursor"] | null>(null)
  const pageHasNext = ref(false)
  const pageHasPrev = ref(false)
  const pageLoading = ref(false)
  const pageError = shallowRef<StellarError | null>(null)
  let requestId = 0

  function install(page: PaymentsPageResult): void {
    displayed.value = page.records
    nextPage.value = page.nextCursor
    prevPage.value = page.prevCursor
    pageHasNext.value = page.hasNext
    pageHasPrev.value = page.hasPrev
    pageError.value = null
  }

  watch(
    query.data,
    page => {
      requestId += 1
      pageLoading.value = false
      if (page) install(page)
      else {
        displayed.value = []
        nextPage.value = null
        prevPage.value = null
        pageHasNext.value = false
        pageHasPrev.value = false
        pageError.value = null
      }
    },
    { immediate: true, flush: "sync" }
  )

  watch(
    () => serializeKey(queryKey.value),
    () => {
      requestId += 1
      displayed.value = []
      nextPage.value = null
      prevPage.value = null
      pageHasNext.value = false
      pageHasPrev.value = false
      pageLoading.value = false
      pageError.value = null
    },
    { flush: "sync" }
  )

  async function navigate(direction: "next" | "prev"): Promise<void> {
    const load = direction === "next" ? nextPage.value : prevPage.value
    if (!load || !address.value) return
    const id = ++requestId
    pageLoading.value = true
    pageError.value = null
    try {
      const response = await load()
      if (id !== requestId || !address.value) return
      const hasMore = response.records.length > limit.value
      const records = hasMore ? response.records.slice(0, limit.value) : response.records
      const normalized = records.map(record => normalizePayment(record, address.value!))
      if (normalized.length > 0) displayed.value = normalized
      nextPage.value = () => response.next()
      prevPage.value = () => response.prev()
      pageHasNext.value = direction === "next" ? hasMore : true
      pageHasPrev.value = direction === "prev" ? hasMore : true
    } catch (cause) {
      if (id !== requestId) return
      pageError.value = toStellarError(cause)
    } finally {
      if (id === requestId) pageLoading.value = false
    }
  }

  async function refetch(): Promise<void> {
    requestId += 1
    pageError.value = null
    await query.refetch()
  }

  const error = computed(() => pageError.value ?? (query.error.value as StellarError | null))
  return {
    payments: computed(() => displayed.value),
    loading: computed(() => pageLoading.value || query.loading.value),
    error,
    isStale: computed(() => error.value !== null && displayed.value.length > 0),
    refetch,
    fetchNext: () => navigate("next"),
    fetchPrev: () => navigate("prev"),
    hasNext: computed(() => pageHasNext.value),
    hasPrev: computed(() => pageHasPrev.value),
  }
}
