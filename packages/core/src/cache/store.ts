import type { CacheEntry, CacheListener, QueryConfig } from "./types"
import { DEFAULT_GC_TIME, DEFAULT_STALE_TIME } from "./types"
import { serializeKey } from "./keys"

/**
 * The central cache store.
 *
 * Responsibilities:
 * - Holds one {@link CacheEntry} per serialised query key.
 * - Shares in-flight promises across subscribers (deduplication).
 * - Tracks subscriber counts and schedules GC eviction via `gcTime`.
 * - Notifies listeners synchronously when an entry changes, so hooks can
 *   re-render without polling.
 */
export class QueryStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private entries = new Map<string, CacheEntry<any>>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<string, Set<CacheListener<any>>>()

  private staleTime: number
  private gcTime: number

  constructor(config: QueryConfig = {}) {
    this.staleTime = config.staleTime ?? DEFAULT_STALE_TIME
    this.gcTime = config.gcTime ?? DEFAULT_GC_TIME
  }

  // ── Entry management ───────────────────────────────────────────────────────

  private getEntry<T>(key: string): CacheEntry<T> | undefined {
    return this.entries.get(key) as CacheEntry<T> | undefined
  }

  private setEntry<T>(key: string, entry: CacheEntry<T>): void {
    this.entries.set(key, entry)
  }

  private initEntry<T>(key: string): CacheEntry<T> {
    const existing = this.getEntry<T>(key)
    if (existing) return existing

    const entry: CacheEntry<T> = {
      data: null,
      updatedAt: null,
      loading: false,
      error: null,
      promise: null,
      subscribers: 0,
      gcTimer: null,
    }
    this.setEntry(key, entry)
    return entry
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  /**
   * Register a listener for an entry. Called by hooks on mount.
   * Returns an unsubscribe function the hook calls on unmount.
   */
  subscribe<T>(key: readonly unknown[], listener: CacheListener<T>): () => void {
    const k = serializeKey(key)
    const entry = this.initEntry<T>(k)

    // Increment subscriber count and cancel any pending GC eviction.
    entry.subscribers += 1
    if (entry.gcTimer !== null) {
      clearTimeout(entry.gcTimer)
      entry.gcTimer = null
    }

    if (!this.listeners.has(k)) {
      this.listeners.set(k, new Set())
    }
    this.listeners.get(k)!.add(listener as CacheListener)

    return () => {
      const e = this.getEntry<T>(k)
      if (!e) return

      e.subscribers = Math.max(0, e.subscribers - 1)
      this.listeners.get(k)?.delete(listener as CacheListener)

      if (e.subscribers === 0) {
        this.scheduleGc(k)
      }
    }
  }

  private scheduleGc(key: string): void {
    const entry = this.getEntry(key)
    if (!entry) return

    // gcTime === 0 means "evict immediately on last unsubscribe".
    const delay = this.gcTime

    if (delay === 0) {
      this.evict(key)
      return
    }

    entry.gcTimer = setTimeout(() => {
      const e = this.getEntry(key)
      if (e && e.subscribers === 0) {
        this.evict(key)
      }
    }, delay)
  }

  private evict(key: string): void {
    const entry = this.getEntry(key)
    if (entry?.gcTimer !== null) {
      clearTimeout(entry!.gcTimer!)
    }
    this.entries.delete(key)
    this.listeners.delete(key)
  }

  // ── Data reads ─────────────────────────────────────────────────────────────

  /**
   * Returns the current snapshot for a key without subscribing.
   */
  getSnapshot<T>(key: readonly unknown[]): CacheEntry<T> | undefined {
    return this.getEntry<T>(serializeKey(key))
  }

  /**
   * Returns true when the cached data is still within `staleTime`.
   */
  isFresh(key: readonly unknown[], staleTime?: number): boolean {
    const entry = this.getEntry(serializeKey(key))
    if (!entry?.updatedAt) return false

    const ttl = staleTime ?? this.staleTime
    return Date.now() - entry.updatedAt < ttl
  }

  /**
   * Returns true when a fetch for this key is already in flight.
   * Hooks use this to decide whether to await the existing promise instead of
   * starting a new one.
   */
  isLoading(key: readonly unknown[]): boolean {
    return this.getEntry(serializeKey(key))?.loading === true
  }

  /**
   * Returns the in-flight promise for the key, if any.
   */
  getInflightPromise<T>(key: readonly unknown[]): Promise<T> | null {
    return this.getEntry<T>(serializeKey(key))?.promise ?? null
  }

  // ── Data writes ────────────────────────────────────────────────────────────

  /**
   * Registers the start of a fetch. Stores the promise so other subscribers
   * can await the same network request.
   */
  setLoading<T>(key: readonly unknown[], promise: Promise<T>): void {
    const k = serializeKey(key)
    const entry = this.initEntry<T>(k)
    entry.loading = true
    entry.error = null
    entry.promise = promise
    this.notify(k)
  }

  /**
   * Stores a successful result and notifies subscribers.
   */
  setData<T>(key: readonly unknown[], data: T): void {
    const k = serializeKey(key)
    const entry = this.initEntry<T>(k)
    entry.data = data
    entry.updatedAt = Date.now()
    entry.loading = false
    entry.error = null
    entry.promise = null
    this.notify(k)
  }

  /**
   * Stores an error result and notifies subscribers.
   */
  setError(key: readonly unknown[], error: unknown): void {
    const k = serializeKey(key)
    const entry = this.initEntry(k)
    entry.loading = false
    entry.error = error
    entry.data = null
    entry.updatedAt = null
    entry.promise = null
    this.notify(k)
  }

  /**
   * Marks an entry as stale by zeroing `updatedAt`, so the next subscriber
   * triggers a refetch even if gcTime has not elapsed.
   *
   * Used by write hooks (send, addTrustline, pathPayment) to invalidate
   * account/balance data after a successful transaction.
   */
  invalidate(key: readonly unknown[]): void {
    const k = serializeKey(key)
    const entry = this.getEntry(k)
    if (!entry) return
    entry.updatedAt = null
    this.notify(k)
  }

  /**
   * Invalidates every key whose serialised form starts with the given prefix
   * array. For example, `invalidatePrefix(["account", horizonUrl, network])`
   * invalidates all account entries for that network.
   */
  invalidatePrefix(prefix: readonly unknown[]): void {
    const prefixStr = JSON.stringify(prefix).slice(0, -1) // remove trailing ]
    for (const [key, entry] of this.entries) {
      if (key.startsWith(prefixStr)) {
        entry.updatedAt = null
        this.notify(key)
      }
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  private notify(key: string): void {
    const entry = this.getEntry(key)
    if (!entry) return

    const set = this.listeners.get(key)
    if (!set) return

    for (const listener of set) {
      listener(entry)
    }
  }

  // ── Introspection (testing) ────────────────────────────────────────────────

  /** Returns the number of entries currently in the store. */
  get size(): number {
    return this.entries.size
  }

  /** Empties the store — useful in tests. */
  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.gcTimer !== null) clearTimeout(entry.gcTimer)
    }
    this.entries.clear()
    this.listeners.clear()
  }
}
