import { useCallback, useEffect, useRef, useState } from "react"
import type { CacheEntry } from "./types"
import { DEFAULT_STALE_TIME } from "./types"
import type { QueryStore } from "./store"
import { serializeKey } from "./keys"
import { retryWithBackoff, getRetryAfterMs } from "../utils/retryWithBackoff"

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
  /**
   * Maximum number of automatic retries after a retriable failure (429, 5xx,
   * network errors). Defaults to 3. Set to 0 to disable automatic retries.
   *
   * When a 429 is received, the `Retry-After` response header is honoured
   * exactly. Other retriable errors use exponential back-off with full jitter.
   */
  maxRetries?: number
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
  /**
   * A ref whose `.current` value is the epoch ms until which this query is
   * rate-limited (from the last 429 `Retry-After` header), or null when not
   * rate-limited. Exposed as a ref so polling hooks can read it without
   * causing re-renders.
   */
  rateLimitedUntilRef: React.MutableRefObject<number | null>
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
 * - On 429: honour `Retry-After`, retry up to `maxRetries` times with
 *   exponential back-off. While retrying, the hook does not surface a loading
 *   state for new renders — the stale data is served until a success or final
 *   failure.
 */
export function useQuery<T>({
  queryKey,
  queryFn,
  store,
  staleTime,
  enabled = true,
  maxRetries = 3,
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

  /**
   * rateLimitedUntilRef tracks when the most recent 429 retry window closes.
   * Stored as a ref (not state) so polling hooks can read it imperatively
   * without triggering re-renders and without act() issues in tests.
   */
  const rateLimitedUntilRef = useRef<number | null>(null)

  // Stable ref to the latest queryFn so the fetch closure always calls the
  // current version without needing it in the dependency array.
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  // Stable ref to staleTime so the fetch closure can read the latest value.
  const staleTimeRef = useRef(staleTime ?? DEFAULT_STALE_TIME)
  staleTimeRef.current = staleTime ?? DEFAULT_STALE_TIME

  // Stable ref to maxRetries.
  const maxRetriesRef = useRef(maxRetries)
  maxRetriesRef.current = maxRetries

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

      const promise = retryWithBackoff(() => queryFnRef.current(), {
        maxRetries: maxRetriesRef.current,
      })

      // Register in store before awaiting so concurrent subscribers see the
      // promise immediately.
      store.setLoading(queryKey, promise)

      try {
        const data = await promise
        // Clear the rate-limit window on success.
        rateLimitedUntilRef.current = null
        store.setData(queryKey, data)
      } catch (err) {
        // Surface rate-limit window to polling hooks via ref (no re-render needed).
        const retryMs = getRetryAfterMs(err)
        if (retryMs !== null) {
          rateLimitedUntilRef.current = Date.now() + retryMs
        } else {
          rateLimitedUntilRef.current = null
        }
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
    rateLimitedUntilRef,
    refetch,
  }
}
