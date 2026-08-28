import { QueryStore } from "./store"
import { accountKey } from "./keys"

describe("QueryStore", () => {
  let store: QueryStore

  beforeEach(() => {
    store = new QueryStore({ staleTime: 30_000, gcTime: 300_000 })
  })

  afterEach(() => {
    store.clear()
  })

  describe("subscriptions", () => {
    it("increments subscriber count on subscribe", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const unsubscribe = store.subscribe(key, () => {})

      const snapshot = store.getSnapshot(key)
      expect(snapshot?.subscribers).toBe(1)

      unsubscribe()
    })

    it("decrements subscriber count on unsubscribe", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const unsubscribe = store.subscribe(key, () => {})
      unsubscribe()

      const snapshot = store.getSnapshot(key)
      expect(snapshot?.subscribers).toBe(0)
    })

    it("notifies listeners when data changes", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const listener = jest.fn()

      store.subscribe(key, listener)
      store.setData(key, { balance: "100" })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: "100" },
          loading: false,
        })
      )
    })

    it("supports multiple listeners for the same key", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      store.subscribe(key, listener1)
      store.subscribe(key, listener2)
      store.setData(key, { balance: "100" })

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })
  })

  describe("data management", () => {
    it("stores and retrieves data", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      store.setData(key, { balance: "100" })

      const snapshot = store.getSnapshot(key)
      expect(snapshot?.data).toEqual({ balance: "100" })
    })

    it("marks entry as loading when setLoading is called", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const promise = Promise.resolve({ balance: "100" })

      store.setLoading(key, promise)

      const snapshot = store.getSnapshot(key)
      expect(snapshot?.loading).toBe(true)
      expect(snapshot?.promise).toBe(promise)
    })

    it("stores error on setError", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const error = new Error("Network error")

      store.setError(key, error)

      const snapshot = store.getSnapshot(key)
      expect(snapshot?.error).toBe(error)
      expect(snapshot?.loading).toBe(false)
    })

    it("sets updatedAt timestamp on successful data write", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const before = Date.now()

      store.setData(key, { balance: "100" })

      const after = Date.now()
      const snapshot = store.getSnapshot(key)

      expect(snapshot?.updatedAt).toBeGreaterThanOrEqual(before)
      expect(snapshot?.updatedAt).toBeLessThanOrEqual(after)
    })
  })

  describe("freshness", () => {
    it("returns true for fresh data within staleTime", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      store.setData(key, { balance: "100" })

      expect(store.isFresh(key)).toBe(true)
    })

    it("returns false for data with no updatedAt", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      store.subscribe(key, () => {}) // Initialize entry

      expect(store.isFresh(key)).toBe(false)
    })

    it("respects per-call staleTime override", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      store.setData(key, { balance: "100" })

      // Fresh with a long staleTime
      expect(store.isFresh(key, 60_000)).toBe(true)

      // Stale with staleTime of 0
      expect(store.isFresh(key, 0)).toBe(false)
    })
  })

  describe("invalidation", () => {
    it("zeros updatedAt on invalidate", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      store.setData(key, { balance: "100" })

      expect(store.getSnapshot(key)?.updatedAt).toBeGreaterThan(0)

      store.invalidate(key)

      expect(store.getSnapshot(key)?.updatedAt).toBe(null)
    })

    it("invalidates all keys matching a prefix", () => {
      const key1 = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const key2 = accountKey("https://horizon-testnet.stellar.org", "testnet", "GXYZ...")
      const key3 = accountKey("https://horizon-testnet.stellar.org", "mainnet", "GABC...")

      store.setData(key1, { balance: "100" })
      store.setData(key2, { balance: "200" })
      store.setData(key3, { balance: "300" })

      // Invalidate all testnet account keys
      store.invalidatePrefix(["account", "https://horizon-testnet.stellar.org", "testnet"])

      expect(store.getSnapshot(key1)?.updatedAt).toBe(null)
      expect(store.getSnapshot(key2)?.updatedAt).toBe(null)
      expect(store.getSnapshot(key3)?.updatedAt).toBeGreaterThan(0) // mainnet unaffected
    })
  })

  describe("garbage collection", () => {
    it("schedules eviction when subscriber count reaches zero", async () => {
      jest.useFakeTimers()

      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const unsubscribe = store.subscribe(key, () => {})
      store.setData(key, { balance: "100" })

      unsubscribe()

      // Entry still exists immediately after unsubscribe
      expect(store.getSnapshot(key)).toBeTruthy()

      // Fast-forward past gcTime
      jest.advanceTimersByTime(300_001)

      // Entry is now evicted
      expect(store.getSnapshot(key)).toBeUndefined()

      jest.useRealTimers()
    })

    it("cancels eviction timer when a new subscriber arrives", async () => {
      jest.useFakeTimers()

      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const unsubscribe1 = store.subscribe(key, () => {})
      store.setData(key, { balance: "100" })

      unsubscribe1()

      // Advance partway through gcTime
      jest.advanceTimersByTime(100_000)

      // New subscriber arrives — timer should be cancelled
      const unsubscribe2 = store.subscribe(key, () => {})

      // Advance past the original gcTime
      jest.advanceTimersByTime(250_000)

      // Entry still exists because timer was cancelled
      expect(store.getSnapshot(key)).toBeTruthy()

      unsubscribe2()
      jest.useRealTimers()
    })

    it("evicts immediately when gcTime is 0", () => {
      const storeImmediate = new QueryStore({ staleTime: 30_000, gcTime: 0 })
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")

      const unsubscribe = storeImmediate.subscribe(key, () => {})
      storeImmediate.setData(key, { balance: "100" })

      unsubscribe()

      // Entry evicted immediately
      expect(storeImmediate.getSnapshot(key)).toBeUndefined()

      storeImmediate.clear()
    })
  })

  describe("deduplication", () => {
    it("shares in-flight promise across subscribers", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const promise = Promise.resolve({ balance: "100" })

      store.setLoading(key, promise)

      expect(store.isLoading(key)).toBe(true)
      expect(store.getInflightPromise(key)).toBe(promise)
    })

    it("clears in-flight promise after data is set", () => {
      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const promise = Promise.resolve({ balance: "100" })

      store.setLoading(key, promise)
      store.setData(key, { balance: "100" })

      expect(store.isLoading(key)).toBe(false)
      expect(store.getInflightPromise(key)).toBe(null)
    })
  })

  describe("introspection", () => {
    it("reports correct size", () => {
      expect(store.size).toBe(0)

      const key1 = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const key2 = accountKey("https://horizon-testnet.stellar.org", "testnet", "GXYZ...")

      store.setData(key1, { balance: "100" })
      expect(store.size).toBe(1)

      store.setData(key2, { balance: "200" })
      expect(store.size).toBe(2)
    })

    it("clears all entries and timers", () => {
      jest.useFakeTimers()

      const key = accountKey("https://horizon-testnet.stellar.org", "testnet", "GABC...")
      const unsubscribe = store.subscribe(key, () => {})
      store.setData(key, { balance: "100" })
      unsubscribe()

      store.clear()

      expect(store.size).toBe(0)
      expect(store.getSnapshot(key)).toBeUndefined()

      jest.useRealTimers()
    })
  })
})
