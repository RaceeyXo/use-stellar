/**
 * React Native AsyncStorage Mock
 * ──────────────────────────────
 * Provides a controllable in-memory mock of AsyncStorage.
 * 
 * Enables deterministic testing of storage operations:
 * - getItem() / setItem() / removeItem() / clear()
 * - Async behavior simulation
 * - Deterministic state resets between tests
 */

interface MockAsyncStorage {
  store: Map<string, string>
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
  getAllKeys(): Promise<string[]>
  multiGet(keys: string[]): Promise<Array<[string, string | null]>>
  multiSet(keyValuePairs: Array<[string, string]>): Promise<void>
  multiRemove(keys: string[]): Promise<void>
  reset(): void
}

/**
 * Singleton mock instance for AsyncStorage.
 * Stores all data in memory and resolves/rejects synchronously in tests.
 */
const mockAsyncStorage: MockAsyncStorage = {
  store: new Map(),

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  },

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  },

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  },

  async clear(): Promise<void> {
    this.store.clear()
  },

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys())
  },

  async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    return keys.map(key => [key, this.store.get(key) ?? null])
  },

  async multiSet(keyValuePairs: Array<[string, string]>): Promise<void> {
    keyValuePairs.forEach(([key, value]) => {
      this.store.set(key, value)
    })
  },

  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach(key => {
      this.store.delete(key)
    })
  },

  reset() {
    this.store.clear()
  },
}

/**
 * Get the raw storage map for test inspection.
 * Use this to inspect stored values directly.
 * 
 * @example
 * const storage = getAsyncStorageMap()
 * expect(storage.get("wallet_session")).toBeDefined()
 */
export function getAsyncStorageMap(): Map<string, string> {
  return mockAsyncStorage.store
}

/**
 * Get a stored value directly (synchronous).
 * Useful for test assertions without awaiting.
 */
export function getAsyncStorageValue(key: string): string | undefined {
  return mockAsyncStorage.store.get(key)
}

/**
 * Set a value directly (synchronous).
 * Useful for test setup.
 */
export function setAsyncStorageValue(key: string, value: string): void {
  mockAsyncStorage.store.set(key, value)
}

/**
 * Clear all stored data and reset to empty.
 * Called by setup.ts beforeEach.
 */
export function resetAsyncStorageMock(): void {
  mockAsyncStorage.reset()
}

export default mockAsyncStorage
