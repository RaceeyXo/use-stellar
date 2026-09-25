/**
 * AsyncStorage-backed session storage adapter for React Native.
 *
 * Provides a Web Storage API-compatible interface for persisting wallet
 * session data (wallet type and address) using React Native's AsyncStorage.
 *
 * Falls back to in-memory storage if AsyncStorage is unavailable.
 */

/**
 * Storage interface compatible with the Web Storage API.
 * Used for persisting autoConnect sessions.
 */
export interface Storage {
  /**
   * Returns the value associated with the key, or null if not found.
   */
  getItem(key: string): string | null | Promise<string | null>

  /**
   * Sets the key/value pair. If the operation is async, returns a Promise.
   */
  setItem(key: string, value: string): void | Promise<void>

  /**
   * Removes the key/value pair. If the operation is async, returns a Promise.
   */
  removeItem(key: string): void | Promise<void>
}

/**
 * Creates an AsyncStorage-backed storage adapter.
 *
 * Wraps React Native's AsyncStorage to provide a Storage API-compatible
 * interface. Since AsyncStorage is always async, the returned methods return
 * Promises, which the autoConnect flow must handle properly.
 *
 * If AsyncStorage cannot be imported, returns a synchronous in-memory storage
 * fallback that does not persist across app restarts.
 */
export function createAsyncStorageAdapter(): Storage {
  let asyncStorage: {
    getItem: (key: string) => Promise<string | null>
    setItem: (key: string, value: string) => Promise<void>
    removeItem: (key: string) => Promise<void>
  } | null = null

  // Attempt to load AsyncStorage dynamically
  try {
    // eslint-disable-next-line global-require
    asyncStorage = require("@react-native-async-storage/async-storage").default
  } catch {
    // AsyncStorage not available — return in-memory fallback
  }

  if (!asyncStorage) {
    // In-memory fallback
    const memory = new Map<string, string>()

    return {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: (key: string) => {
        memory.delete(key)
      },
    }
  }

  // AsyncStorage adapter
  return {
    getItem: (key: string) => asyncStorage!.getItem(key),
    setItem: (key: string, value: string) => asyncStorage!.setItem(key, value),
    removeItem: (key: string) => asyncStorage!.removeItem(key),
  }
}

/**
 * Creates an in-memory storage adapter for testing.
 *
 * Does not persist across app restarts or between mounts.
 */
export function createInMemoryStorage(): Storage {
  const memory = new Map<string, string>()

  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
  }
}
