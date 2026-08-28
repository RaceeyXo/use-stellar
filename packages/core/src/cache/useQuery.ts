import { useCallback, useEffect, useRef, useState } from "react"
import type { CacheEntry } from "./types"
import { DEFAULT_STALE_TIME } from "./types"
import type { QueryStore } from "./store"
import { serializeKey } from "./keys"

/**
 * Options for `useQuery`.
 */
export interface UseQueryOptions<T> {
  /** The query key that identifies this request in the store. */
  queryKey: readonly unknown[]
  /** The async function that performs the actual network request. */
  queryFn: () => Promise<T>
  /** The store instance from the StellarProvider context. */
  store: QueryStore
  /**
   * How long (ms) data is considered fresh. Overrides the provider default.
   * Set to 0 to always re-fetch on mount.
   */
  staleTime?: number
  /**
   * Set to false to skip the fetch entirely (like `enabled: false` in TanStack
   * Query). The hook returns the current store snapshot but never fetches.
   */
  enabled?: boolean
}

/**
 * Return shape mirroring what every existing hook already exposes, so the
 * cache is truly an implementation detail.
 */
export interface UseQueryResult<T> {
  data: T | null
  loading: boolean
  error: unknown
  /** Imperatively trigger a fresh fetch, bypassing staleTime. */
  refetch: () => void
  /** Epoch ms of the most recent successful fetch, or null. */
  updatedAt: number | null
}

/**
 * The core caching primitive consumed by every read hook.
 *
 * Behaviour:
 * - On mount: subscribe to the store and run the query unless the cached data
 *   is still within `staleTime`.
 * - While a fetch is in flight for the same key: await the existing promise
 *   (deduplication — no second network request).
 * - On success/error: write the result to the store; all subscribers re-render.
 * - On unmount: unsubscribe; if subscriber count drops to zero the GC timer
 *   starts.
 */
export function useQuery<T>({
  queryKey,
  queryFn,
  store,
  staleTime,
  enabled = true,
}: UseQueryOptions<T>): UseQueryResult<T> {
  // ── Local state mirrors the store entry ──────────────────────────────────
  // We keep a local copy so React's reconciler knows when to re-render this
  // specific hook instance. The store itself is the source of truth; this is
  // just the projection.
  const snapshot = store.getSnapshot<T>(queryKey)
  const [localState, setLocalState] = useState<{
    data: T | null
    loading: boolean
    error: unknown
    updatedAt: number | null
  }>(() => ({
    data: snapshot?.data ?? null,
    loading: snapshot?.loading ?? false,
    error: snapshot?.error ?? null,
    updatedAt: snapshot?.updatedAt ?? null,
  }))

  // Stable ref to the latest queryFn so the fetch closure always calls the
  // current version without needing it in the dependency array.
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  // Stable ref to staleTime so the fetch closure can read the latest value.
  const staleTimeRef = useRef(staleTime ?? DEFAULT_STALE_TIME)
  staleTimeRef.current = staleTime ?? DEFAULT_STALE_TIME

  // Key serialised as a string for stable comparisons inside effects.
  const keyStr = serializeKey(queryKey)

  // ── Fetch function ────────────────────────────────────────────────────────
  const fetch = useCallback(
    async (forceRefetch = false) => {
      if (!enabled) return

      // Deduplication: if a fetch for this key is already running, await it
      // and use its result — no second network request.
      const inflight = store.getInflightPromise<T>(queryKey)
      if (inflight && !forceRefetch) {
        try {
          await inflight
        } catch {
          // The error was already stored by whoever started the fetch.
        }
        return
      }

      // Freshness: skip the request if data is within staleTime.
      if (!forceRefetch && store.isFresh(queryKey, staleTimeRef.current)) {
        return
      }

      const promise = queryFnRef.current()

      // Register in store before awaiting so concurrent subscribers see the
      // promise immediately.
      store.setLoading(queryKey, promise)

      try {
        const data = await promise
        store.setData(queryKey, data)
      } catch (err) {
        store.setError(queryKey, err)
      }
    },
    // eslint-disable-next-line
    [keyStr, store, enabled]
  )

  // ── Subscription ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // The listener is called synchronously by the store whenever the entry
    // changes, updating local state so this hook instance re-renders.
    const unsubscribe = store.subscribe<T>(queryKey, (entry: CacheEntry<T>) => {
      setLocalState({
        data: entry.data,
        loading: entry.loading,
        error: entry.error,
        updatedAt: entry.updatedAt,
      })
    })

    // Initial fetch (skipped when data is still fresh).
    void fetch(false)

    return () => {
      unsubscribe()
    }
    // eslint-disable-next-line
  }, [keyStr, store, enabled, fetch])

  // ── Imperative refetch ────────────────────────────────────────────────────
  const refetch = useCallback(() => {
    void fetch(true)
  }, [fetch])

  return {
    data: localState.data,
    loading: localState.loading,
    error: localState.error,
    updatedAt: localState.updatedAt,
    refetch,
  }
}
