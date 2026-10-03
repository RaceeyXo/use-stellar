/**
 * AppState-based focus manager for React Native.
 *
 * Integrates with React Native's AppState to track whether the app is in the
 * foreground or background. Used by polling hooks to pause requests while the
 * app is backgrounded and resume on foreground.
 *
 * Falls back to "always focused" if AppState is unavailable.
 */

type AppStateStatus = "active" | "background" | "inactive" | "unknown" | "extension"

type AppStateLike = {
  currentState: AppStateStatus
  addEventListener: (
    event: "change",
    handler: (state: AppStateStatus) => void
  ) => { remove?: () => void }
}

/**
 * Focus manager interface for tracking app foreground/background state.
 */
export interface FocusManager {
  /**
   * Returns whether the app is currently focused (in foreground).
   */
  isFocused(): boolean

  /**
   * Subscribes to focus changes. The handler receives `true` when the app
   * comes to foreground, `false` when it goes to background.
   *
   * Returns an unsubscribe function.
   */
  subscribe(handler: (isFocused: boolean) => void): () => void
}

/**
 * Creates a focus manager backed by React Native's AppState.
 *
 * Calls the handler immediately with the current state, then again whenever
 * the app foreground/background state changes.
 *
 * If AppState cannot be imported (e.g., in tests or non-RN environments),
 * returns a fallback manager that is always focused.
 */
export function createAppStateFocusManager(): FocusManager {
  let appState: AppStateLike | null = null
  let currentState: AppStateStatus | null = null
  let isFocused = true

  // Attempt to load AppState dynamically
  try {
    // Optional native module: loaded lazily so a missing install falls back.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactNative = require("react-native")
    appState = ReactNative.AppState
  } catch {
    // AppState not available — return fallback
  }

  if (!appState) {
    // Fallback: always focused
    return {
      isFocused: () => true,
      subscribe: (handler: (isFocused: boolean) => void) => {
        handler(true)
        return () => {}
      },
    }
  }

  const subscribers = new Set<(isFocused: boolean) => void>()

  function safeCall(handler: (isFocused: boolean) => void, focused: boolean) {
    try {
      handler(focused)
    } catch {
      // Suppress handler errors to avoid breaking the app
    }
  }

  function notifySubscribers(focused: boolean) {
    subscribers.forEach(handler => safeCall(handler, focused))
  }

  // Subscribe to AppState changes. If that fails, the manager keeps reporting
  // the initial state rather than breaking the provider.
  try {
    appState.addEventListener("change", (newState: AppStateStatus) => {
      currentState = newState
      const nowFocused = newState === "active"

      if (isFocused !== nowFocused) {
        isFocused = nowFocused
        notifySubscribers(nowFocused)
      }
    })
  } catch {
    // Continue with the initial state only
  }

  // Get initial state
  try {
    currentState = appState.currentState as AppStateStatus
    isFocused = currentState === "active"
  } catch {
    isFocused = true
  }

  return {
    isFocused: () => isFocused,
    subscribe: (handler: (isFocused: boolean) => void) => {
      subscribers.add(handler)
      // Immediately notify with current state
      safeCall(handler, isFocused)

      return () => {
        subscribers.delete(handler)
      }
    },
  }
}

/**
 * Creates a fallback focus manager that is always focused.
 *
 * Used for testing and non-RN environments.
 */
export function createAlwaysFocusedManager(): FocusManager {
  return {
    isFocused: () => true,
    subscribe: (handler: (isFocused: boolean) => void) => {
      handler(true)
      return () => {}
    },
  }
}
