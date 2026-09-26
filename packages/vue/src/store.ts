// packages/vue/src/store.ts
//
// A Vue-native counterpart to the core package's QueryStore: one instance per
// installed plugin, shared by every composable that reads through it. This is
// the one shared cache for a Vue app — composables must never keep a private
// cache of their own, the same way every React hook shares the one QueryStore
// a StellarProvider creates.

import { reactive } from "vue"

export interface QueryStoreConfig {
  /** How long (ms) data is considered fresh. Defaults to 30 000 (30s). */
  staleTime?: number
  /** How long (ms) an entry is kept after its last subscriber leaves. Defaults to 300 000 (5min). */
  gcTime?: number
}

/** The reactive shape a composable reads. Mutating it directly is not supported — go through the store. */
export interface QueryEntry<T = unknown> {
  data: T | null
  updatedAt: number | null
  loading: boolean
  error: unknown
}

interface InternalEntry<T> extends QueryEntry<T> {
  promise: Promise<T> | null
  subscribers: number
  gcTimer: ReturnType<typeof setTimeout> | null
}

const DEFAULT_STALE_TIME = 30_000
const DEFAULT_GC_TIME = 300_000

export interface RunOptions {
  /** Overrides the store's default staleTime for this call. */
  staleTime?: number
  /** Bypasses both the in-flight dedup check and the staleTime check. */
  force?: boolean
}

export class VueQueryStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private entries = reactive(new Map<string, InternalEntry<any>>())
  private staleTime: number
  private gcTime: number

  constructor(config: QueryStoreConfig = {}) {
    this.staleTime = config.staleTime ?? DEFAULT_STALE_TIME
    this.gcTime = config.gcTime ?? DEFAULT_GC_TIME
  }

  private ensure<T>(key: string): InternalEntry<T> {
    const existing = this.entries.get(key) as InternalEntry<T> | undefined
    if (existing) return existing

    const entry: InternalEntry<T> = {
      data: null,
      updatedAt: null,
      loading: false,
      error: null,
      promise: null,
      subscribers: 0,
      gcTimer: null,
    }
    this.entries.set(key, entry)
    return entry
  }

  /**
   * The live, reactive entry for a key. Read its fields inside a `computed`
   * or `watchEffect` — Vue tracks the read and re-runs when the store writes
   * to it.
   */
  getEntry<T>(key: string): QueryEntry<T> {
    return this.ensure<T>(key)
  }

  /**
   * Registers a subscriber for `key` and cancels any pending GC eviction.
   * Returns the unsubscribe function — call it from `onCleanup` /
   * `onScopeDispose` so an idle entry is eventually evicted.
   */
  subscribe(key: string): () => void {
    const entry = this.ensure(key)
    entry.subscribers += 1
    if (entry.gcTimer !== null) {
      clearTimeout(entry.gcTimer)
      entry.gcTimer = null
    }

    return () => {
      entry.subscribers = Math.max(0, entry.subscribers - 1)
      if (entry.subscribers === 0) this.scheduleGc(key, entry)
    }
  }

  /** Number of active subscribers for a key. Exposed for tests. */
  subscriberCount(key: string): number {
    return this.entries.get(key)?.subscribers ?? 0
  }

  private scheduleGc(key: string, entry: InternalEntry<unknown>): void {
    if (this.gcTime === 0) {
      this.entries.delete(key)
      return
    }
    entry.gcTimer = setTimeout(() => {
      if (entry.subscribers === 0) this.entries.delete(key)
    }, this.gcTime)
  }

  isFresh(key: string, staleTime?: number): boolean {
    const entry = this.entries.get(key)
    if (!entry?.updatedAt) return false
    return Date.now() - entry.updatedAt < (staleTime ?? this.staleTime)
  }

  /**
   * Runs `queryFn` for `key`, deduplicated: a call made while a fetch for the
   * same key is already in flight awaits that same promise instead of
   * issuing a second request — this is what lets two Vue scopes reading the
   * same query share one network call. Skipped entirely when cached data is
   * still within `staleTime`, unless `force` is set.
   */
  run<T>(key: string, queryFn: () => Promise<T>, opts: RunOptions = {}): Promise<T> {
    const entry = this.ensure<T>(key)

    if (!opts.force) {
      if (entry.promise) return entry.promise
      if (entry.data !== null && this.isFresh(key, opts.staleTime)) {
        return Promise.resolve(entry.data)
      }
    }

    entry.loading = true
    entry.error = null

    const promise = queryFn().then(
      data => {
        entry.data = data
        entry.updatedAt = Date.now()
        entry.loading = false
        entry.error = null
        entry.promise = null
        return data
      },
      err => {
        entry.loading = false
        entry.error = err
        entry.promise = null
        throw err
      }
    )

    entry.promise = promise
    return promise
  }

  /** Empties the store. Useful in tests; not meant for app code. */
  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.gcTimer !== null) clearTimeout(entry.gcTimer)
    }
    this.entries.clear()
  }
}
