/**
 * NetInfo-based online manager for React Native.
 *
 * Integrates with @react-native-community/netinfo to track whether the device
 * has network connectivity. Used by query hooks to pause network requests while
 * offline and resume on reconnect.
 *
 * Falls back to "always online" if NetInfo is unavailable.
 */

/**
 * Online manager interface for tracking device connectivity state.
 */
export interface OnlineManager {
  /**
   * Returns whether the device is currently online.
   */
  isOnline(): boolean

  /**
   * Subscribes to online/offline changes. The handler receives `true` when
   * connectivity is established, `false` when lost.
   *
   * Returns an unsubscribe function.
   */
  subscribe(handler: (isOnline: boolean) => void): () => void
}

/**
 * Creates an online manager backed by @react-native-community/netinfo.
 *
 * Calls the handler immediately with the current connectivity state, then
 * again whenever the device goes online or offline.
 *
 * If NetInfo cannot be imported (e.g., not installed, in tests, or non-RN
 * environments), returns a fallback manager that is always online.
 */
export function createNetInfoOnlineManager(): OnlineManager {
  let netInfo: {
    addEventListener: (
      listener: (state: { isConnected: boolean | null }) => void
    ) => { unsubscribe: () => void }
    fetch: () => Promise<{ isConnected: boolean | null }>
  } | null = null
  let isOnline = true

  // Attempt to load NetInfo dynamically
  try {
    // eslint-disable-next-line global-require
    netInfo = require("@react-native-community/netinfo")
  } catch {
    // NetInfo not available — return fallback
  }

  if (!netInfo) {
    // Fallback: always online
    return {
      isOnline: () => true,
      subscribe: (handler: (isOnline: boolean) => void) => {
        handler(true)
        return () => {}
      },
    }
  }

  const subscribers = new Set<(isOnline: boolean) => void>()

  function notifySubscribers(online: boolean) {
    subscribers.forEach(handler => {
      try {
        handler(online)
      } catch {
        // Suppress handler errors to avoid breaking the app
      }
    })
  }

  // Subscribe to NetInfo changes
  let unsubscribe: (() => void) | null = null
  try {
    const subscription = netInfo.addEventListener((state: { isConnected: boolean | null }) => {
      const nowOnline = state.isConnected === true

      if (isOnline !== nowOnline) {
        isOnline = nowOnline
        notifySubscribers(nowOnline)
      }
    })

    unsubscribe = subscription.unsubscribe
  } catch {
    // If addEventListener fails, continue with fallback behavior
  }

  // Get initial state
  void (async () => {
    try {
      const state = await netInfo.fetch()
      const nowOnline = state.isConnected === true

      if (isOnline !== nowOnline) {
        isOnline = nowOnline
        notifySubscribers(nowOnline)
      }
    } catch {
      // If fetch fails, continue with current state
    }
  })()

  return {
    isOnline: () => isOnline,
    subscribe: (handler: (isOnline: boolean) => void) => {
      subscribers.add(handler)
      // Immediately notify with current state
      handler(isOnline)

      return () => {
        subscribers.delete(handler)
      }
    },
  }
}

/**
 * Creates a fallback online manager that is always online.
 *
 * Used for testing and non-RN environments.
 */
export function createAlwaysOnlineManager(): OnlineManager {
  return {
    isOnline: () => true,
    subscribe: (handler: (isOnline: boolean) => void) => {
      handler(true)
      return () => {}
    },
  }
}
