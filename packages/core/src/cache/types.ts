/**
 * Cache configuration — how long data is considered fresh and how long it is
 * kept after the last subscriber leaves.
 *
 * staleTime: Data younger than this is served from cache without a network
 *            request. After it expires the next subscriber triggers a refetch,
 *            but the stale data is still returned immediately while the refresh
 *            is in flight (stale-while-revalidate).
 *
 * gcTime:    How long (ms) an entry survives after its subscriber count drops
 *            to zero. This is what lets an unmount/remount within a navigation
 *            serve from cache rather than firing a new request.
 *
 * Both values are in milliseconds.
 */
export interface QueryConfig {
  /**
   * How long (ms) data is considered fresh. Defaults to 30 000 (30 s).
   * Set to 0 to always re-fetch on mount.
   */
  staleTime?: number
  /**
   * How long (ms) an entry is kept after all subscribers leave.
   * Defaults to 300 000 (5 min). Set to 0 to evict immediately on unmount.
   */
  gcTime?: number
}

/** Default cache timings, applied at the store level unless overridden. */
export const DEFAULT_STALE_TIME = 30_000
export const DEFAULT_GC_TIME = 300_000

/**
 * One slot in the store. Keyed by a serialised query key string.
 */
export interface CacheEntry<T = unknown> {
  /** Latest successfully fetched value. */
  data: T | null
  /** Epoch ms of the most recent successful fetch. */
  updatedAt: number | null
  /** Whether a fetch is currently in flight. */
  loading: boolean
  /** Last error, if the most recent fetch failed. */
  error: unknown
  /**
   * The in-flight promise, shared by every subscriber that arrives while a
   * fetch is already running. This is the deduplication mechanism.
   */
  promise: Promise<T> | null
  /** Number of hook instances currently subscribed to this key. */
  subscribers: number
  /** Handle returned by setTimeout for the GC eviction timer. */
  gcTimer: ReturnType<typeof setTimeout> | null
}

/**
 * The listener shape hooks register to receive cache updates without polling.
 */
export type CacheListener<T = unknown> = (entry: CacheEntry<T>) => void
