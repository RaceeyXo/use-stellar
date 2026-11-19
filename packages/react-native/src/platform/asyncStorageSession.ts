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

interface AsyncStorageLike {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

/**
 * Returns `@react-native-async-storage/async-storage`, or `null` when it is
 * not installed or its native module is not linked (the package throws on
 * import in that case).
 *
 * The `require` is a literal inside a `try` block on purpose: that is the form
 * Metro recognises as an optional dependency, so an app without AsyncStorage
 * still bundles — and it is never loaded at module scope, so importing this
 * package cannot crash on it.
 */
export function loadAsyncStorage(): AsyncStorageLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-async-storage/async-storage")
    const asyncStorage = (mod?.default ?? mod) as AsyncStorageLike | undefined
    return asyncStorage && typeof asyncStorage.getItem === "function" ? asyncStorage : null
  } catch {
    return null
  }
}

/**
 * Creates an AsyncStorage-backed storage adapter.
 *
 * Wraps React Native's AsyncStorage to provide a Storage API-compatible
 * interface. Since AsyncStorage is always async, the returned methods return
 * Promises, which the autoConnect flow must handle properly.
 *
 * If AsyncStorage cannot be loaded, returns a synchronous in-memory storage
 * fallback that does not persist across app restarts.
 */
export function createAsyncStorageAdapter(): Storage {
  const asyncStorage = loadAsyncStorage()
  if (!asyncStorage) return createInMemoryStorage()

  return {
    getItem: (key: string) => asyncStorage.getItem(key),
    setItem: (key: string, value: string) => asyncStorage.setItem(key, value),
    removeItem: (key: string) => asyncStorage.removeItem(key),
  }
}

/**
 * Creates an in-memory storage adapter.
 *
 * Does not persist across app restarts or between mounts. Used as the fallback
 * when AsyncStorage is unavailable, and in tests.
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
