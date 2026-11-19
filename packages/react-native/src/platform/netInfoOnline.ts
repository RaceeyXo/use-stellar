/**
 * NetInfo-based online manager for React Native.
 *
 * Integrates with @react-native-community/netinfo to track whether the device
 * has network connectivity. Used by query hooks to pause network requests while
 * offline and resume on reconnect.
 *
 * Falls back to "always online" if NetInfo is unavailable.
 */

interface NetInfoState {
  isConnected: boolean | null
}

interface NetInfoLike {
  /** Returns an unsubscribe function (older versions returned `{ unsubscribe }`). */
  addEventListener: (
    listener: (state: NetInfoState) => void
  ) => (() => void) | { unsubscribe?: () => void } | void
  fetch: () => Promise<NetInfoState>
}

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
 * Returns `@react-native-community/netinfo`, or `null` when it is not
 * installed (or its native half is not linked).
 *
 * The `require` is a literal inside a `try` block on purpose: that is the form
 * Metro recognises as an optional dependency, so an app without NetInfo still
 * bundles.
 */
export function loadNetInfo(): NetInfoLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-community/netinfo")
    const netInfo = (mod?.default ?? mod) as NetInfoLike | undefined
    return netInfo && typeof netInfo.addEventListener === "function" ? netInfo : null
  } catch {
    return null
  }
}

/**
 * NetInfo reports `null` while it has not determined the state yet. Only an
 * explicit `false` means offline — treating "unknown" as offline would pause
 * every query at startup until the first event arrives.
 */
function isOnlineState(state: NetInfoState): boolean {
  return state.isConnected !== false
}

/**
 * Creates an online manager backed by @react-native-community/netinfo.
 *
 * Calls the handler immediately with the current connectivity state, then
 * again whenever the device goes online or offline.
 *
 * The NetInfo listener is attached with the first subscriber and removed with
 * the last, so creating a manager (or remounting the provider that owns one)
 * never leaves a native listener behind.
 *
 * If NetInfo cannot be loaded (e.g. not installed, or a non-RN environment),
 * returns a fallback manager that is always online.
 */
export function createNetInfoOnlineManager(): OnlineManager {
  const netInfo = loadNetInfo()
  if (!netInfo) return createAlwaysOnlineManager()

  const subscribers = new Set<(isOnline: boolean) => void>()
  let unsubscribeNetInfo: (() => void) | null = null
  let online = true

  function safeCall(handler: (isOnline: boolean) => void, value: boolean) {
    try {
      handler(value)
    } catch {
      // Suppress handler errors to avoid breaking the app
    }
  }

  function update(state: NetInfoState) {
    const nowOnline = isOnlineState(state)
    if (online === nowOnline) return
    online = nowOnline
    subscribers.forEach(handler => safeCall(handler, nowOnline))
  }

  function attach() {
    try {
      const result = netInfo!.addEventListener(update)
      unsubscribeNetInfo =
        typeof result === "function"
          ? result
          : typeof result?.unsubscribe === "function"
            ? () => result.unsubscribe?.()
            : null
    } catch {
      // If addEventListener fails, continue with the last known state
    }

    // Ask for the current state too; older NetInfo versions do not emit one on
    // subscribe.
    const attached = unsubscribeNetInfo
    void netInfo!
      .fetch()
      .then(state => {
        // Ignore an answer that arrives after this listener was detached.
        if (unsubscribeNetInfo === attached && subscribers.size > 0) update(state)
      })
      .catch(() => {
        // If fetch fails, continue with the current state
      })
  }

  function detach() {
    unsubscribeNetInfo?.()
    unsubscribeNetInfo = null
    // Nothing is listening any more, so the last state can go stale. Start the
    // next subscription from "online" until NetInfo says otherwise.
    online = true
  }

  return {
    isOnline: () => online,
    subscribe: (handler: (isOnline: boolean) => void) => {
      subscribers.add(handler)
      if (subscribers.size === 1) attach()
      // Immediately notify with current state
      safeCall(handler, online)

      return () => {
        subscribers.delete(handler)
        if (subscribers.size === 0) detach()
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
