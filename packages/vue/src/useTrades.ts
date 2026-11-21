import { computed, onScopeDispose, shallowRef, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from "vue"
import {
  tradesKey,
  fetchTradesPage,
  assetToKey,
  normalizeTrade,
  type Asset,
  type NormalizedTrade,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"
export type { MaybeRefOrGetter } from "vue"

export interface UseTradesOptions {
  /**
   * Stellar account address. When provided, only trades involving this
   * account are returned. Also used to derive `side` on each trade.
   * Defaults to the connected wallet address if omitted.
   */
  address?: MaybeRefOrGetter<string | null | undefined>
  /**
   * The asset you want on the base side of every returned trade.
   * Must be paired with `counterAsset`. Together they filter to a specific
   * orderbook and also define the normalized orientation rule.
   */
  baseAsset?: Asset | null
  /**
   * The asset you want on the counter side of every returned trade.
   * Must be paired with `baseAsset`.
   */
  counterAsset?: Asset | null
  /** Number of trades per page (default 10). */
  limit?: MaybeRefOrGetter<number>
  /** Sort order (default `"desc"` — most recent first). */
  order?: MaybeRefOrGetter<"asc" | "desc">
  /** Retries after a rate limit (429), honouring `Retry-After`. */
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UseTradesReturn {
  trades: ComputedRef<NormalizedTrade[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
  /** `true` when a next page is available. */
  hasNext: ComputedRef<boolean>
  /** `true` when a previous page is available. */
  hasPrev: ComputedRef<boolean>
  /** Load the next page of trades. */
  fetchNext: () => Promise<void>
  /** Load the previous page of trades. */
  fetchPrev: () => Promise<void>
}

interface PageState {
  trades: NormalizedTrade[]
  hasNext: boolean
  hasPrev: boolean
}

export function useTrades(options: UseTradesOptions = {}): UseTradesReturn {
  const runtime = useStellarRuntime()

  const address = computed(() => {
    const value =
      options.address === undefined ? runtime.walletAddress.value : toValue(options.address)
    return value?.trim() || null
  })
  const limit = computed(() => toValue(options.limit) ?? 10)
  const order = computed(() => toValue(options.order) ?? "desc")

  // Memoize asset identity on primitive values, not object references.
  const baseAssetKey = computed(() => assetToKey(options.baseAsset))
  const counterAssetKey = computed(() => assetToKey(options.counterAsset))

  // At least one filter must be provided; otherwise the query is disabled.
  const enabled = computed(
    () => address.value !== null || (options.baseAsset !== null && options.baseAsset !== undefined)
  )

  // Track pagination state separately from cache
  const pageState: Ref<PageState> = shallowRef({
    trades: [],
    hasNext: false,
    hasPrev: false,
  })

  // Use shallow refs for pagination cursors (don't need deep reactivity)
  const nextCursorRef: Ref<(() => Promise<any>) | null> = shallowRef(null)
  const prevCursorRef: Ref<(() => Promise<any>) | null> = shallowRef(null)

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () => {
      if (!enabled.value) {
        return ["trades", "disabled"] as const
      }
      return tradesKey(
        runtime.networkConfig.horizonUrl,
        runtime.networkConfig.network,
        address.value ?? "",
        baseAssetKey.value,
        counterAssetKey.value,
        limit.value,
        order.value
      )
    },
    queryFn: async () => {
      const page = await fetchTradesPage(runtime.networkConfig, {
        address: address.value,
        baseAsset: options.baseAsset,
        counterAsset: options.counterAsset,
        limit: limit.value,
        order: order.value,
      })

      // Store cursor refs for pagination
      nextCursorRef.value = page.nextCursor
      prevCursorRef.value = page.prevCursor

      // Update page state when query changes
      pageState.value = {
        trades: page.records,
        hasNext: page.hasNext,
        hasPrev: page.hasPrev,
      }

      return {
        trades: page.records,
        hasNext: page.hasNext,
        hasPrev: page.hasPrev,
      }
    },
    enabled: () => enabled.value,
    maxRetries: options.maxRetries,
  })

  const fetchNext = async () => {
    if (!nextCursorRef.value) return
    try {
      const res = await nextCursorRef.value()
      const normalized = res.records.map((rec: any) =>
        normalizeTrade(rec, address.value ?? null, options.baseAsset ?? null)
      )

      nextCursorRef.value = res.records.length > 0 ? () => res.next() : null
      prevCursorRef.value = res.records.length > 0 ? () => res.prev() : null

      // Update page state with new page
      pageState.value = {
        trades: normalized,
        hasNext: res.records.length >= limit.value,
        hasPrev: true,
      }
    } catch (err) {
      throw err
    }
  }

  const fetchPrev = async () => {
    if (!prevCursorRef.value) return
    try {
      const res = await prevCursorRef.value()
      const normalized = res.records.map((rec: any) =>
        normalizeTrade(rec, address.value ?? null, options.baseAsset ?? null)
      )

      nextCursorRef.value = res.records.length > 0 ? () => res.next() : null
      prevCursorRef.value = res.records.length > 0 ? () => res.prev() : null

      // Update page state with new page
      pageState.value = {
        trades: normalized,
        hasNext: true,
        hasPrev: res.records.length >= limit.value,
      }
    } catch (err) {
      throw err
    }
  }

  // Clear pagination state when query parameters change
  const watchers = computed(() => [
    address.value,
    baseAssetKey.value,
    counterAssetKey.value,
    limit.value,
    order.value,
    enabled.value,
  ])

  let lastWatchedValue: unknown = null
  const queryKeyComputed = computed(() => {
    const currentValue = JSON.stringify(watchers.value)
    if (lastWatchedValue !== currentValue) {
      lastWatchedValue = currentValue
      nextCursorRef.value = null
      prevCursorRef.value = null
      pageState.value = { trades: [], hasNext: false, hasPrev: false }
    }
    return currentValue
  })

  // Ensure cleanup happens when scope is disposed
  onScopeDispose(() => {
    nextCursorRef.value = null
    prevCursorRef.value = null
  })

  return {
    trades: computed(() => pageState.value.trades),
    loading: computed(() => query.loading.value),
    error: computed(() => query.error.value as StellarError | null),
    refetch: query.refetch,
    hasNext: computed(() => pageState.value.hasNext),
    hasPrev: computed(() => pageState.value.hasPrev),
    fetchNext,
    fetchPrev,
  }
}
