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
  fetchTransactionHistoryPage,
  normalizeTransaction,
  serializeKey,
  toStellarError,
  transactionHistoryKey,
  type NormalizedTransaction,
  type StellarError,
  type TransactionHistoryPageResult,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UseTransactionHistoryOptions {
  /** Defaults to the connected wallet. An empty or null value keeps the composable idle. */
  address?: MaybeRefOrGetter<string | null | undefined>
  /** Transactions per page. Default 10. */
  limit?: MaybeRefOrGetter<number | undefined>
  /** Default "desc": newest first. */
  order?: MaybeRefOrGetter<"asc" | "desc" | undefined>
  /** Paging token to start from. */
  cursor?: MaybeRefOrGetter<string | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UseTransactionHistoryReturn {
  transactions: ComputedRef<NormalizedTransaction[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  /** An error is set while a page fetched earlier is still shown. */
  isStale: ComputedRef<boolean>
  refetch: () => Promise<void>
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: ComputedRef<boolean>
  hasPrev: ComputedRef<boolean>
}

/**
 * An account's transaction history, one page at a time.
 *
 * The first page is read through the shared query store under the key the
 * React hook uses, so every reader of the same account, limit, order and
 * cursor shares one request. Later pages are fetched by `fetchNext` and
 * `fetchPrev` and are not cached, as in `usePayments`.
 *
 * @example
 * const { transactions, hasNext, fetchNext } = useTransactionHistory({ address: "G..." })
 */
export function useTransactionHistory(
  options: UseTransactionHistoryOptions = {}
): UseTransactionHistoryReturn {
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
  // Another account, page size or order starts again from its own first page.
  watch([address, limit, order], () => (activeCursor.value = undefined), { flush: "sync" })

  const queryKey = computed(() =>
    address.value
      ? transactionHistoryKey(
          runtime.networkConfig.horizonUrl,
          runtime.networkConfig.network,
          address.value,
          limit.value,
          order.value,
          activeCursor.value
        )
      : (["transactionHistory", "disabled"] as const)
  )
  const query = useQuery<TransactionHistoryPageResult>({
    store: runtime.queryStore,
    queryKey: () => queryKey.value,
    queryFn: () =>
      fetchTransactionHistoryPage(runtime.networkConfig, {
        address: address.value!,
        limit: limit.value,
        order: order.value,
        cursor: activeCursor.value,
      }),
    enabled: () => address.value !== null,
    maxRetries: options.maxRetries,
  })

  const displayed = shallowRef<NormalizedTransaction[]>([])
  const nextPage = shallowRef<TransactionHistoryPageResult["nextCursor"] | null>(null)
  const prevPage = shallowRef<TransactionHistoryPageResult["prevCursor"] | null>(null)
  const pageHasNext = ref(false)
  const pageHasPrev = ref(false)
  const pageLoading = ref(false)
  const pageError = shallowRef<StellarError | null>(null)
  // Claimed by every navigation, refetch and key change. A page that comes
  // back after a newer one has claimed the display is dropped.
  let requestId = 0

  function install(page: TransactionHistoryPageResult): void {
    displayed.value = page.records
    nextPage.value = page.nextCursor
    prevPage.value = page.prevCursor
    pageHasNext.value = page.hasNext
    pageHasPrev.value = page.hasPrev
    pageError.value = null
  }

  function clear(): void {
    displayed.value = []
    nextPage.value = null
    prevPage.value = null
    pageHasNext.value = false
    pageHasPrev.value = false
    pageError.value = null
  }

  watch(
    query.data,
    page => {
      requestId += 1
      pageLoading.value = false
      if (page) install(page)
      else clear()
    },
    { immediate: true, flush: "sync" }
  )

  watch(
    () => serializeKey(queryKey.value),
    () => {
      requestId += 1
      pageLoading.value = false
      clear()
    },
    { flush: "sync" }
  )

  async function navigate(direction: "next" | "prev"): Promise<void> {
    // No link means no page to step from: idle, or still loading the first.
    const load = direction === "next" ? nextPage.value : prevPage.value
    if (!load) return
    const id = ++requestId
    pageLoading.value = true
    pageError.value = null
    try {
      const response = await load()
      if (id !== requestId) return
      // One more than the page size is asked for: the extra record says
      // whether there is a further page, and is not shown.
      const hasMore = response.records.length > limit.value
      const records = hasMore ? response.records.slice(0, limit.value) : response.records
      const normalized = records.map(normalizeTransaction)
      // Stepping past the end keeps the page already on screen.
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
    transactions: computed(() => displayed.value),
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
