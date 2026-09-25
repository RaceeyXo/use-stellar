/**
 * AppState-based focus manager for React Native.
 *
 * Integrates with React Native's AppState to track whether the app is in the
 * foreground or background. Used by polling hooks to pause requests while the
 * app is backgrounded and resume on foreground.
 *
 * Falls back to "always focused" if AppState is unavailable.
 */

import type { AppStateStatus } from "react-native"

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
  let appState: typeof import("react-native").AppState | null = null
  let currentState: AppStateStatus | null = null
  let isFocused = true

  // Attempt to load AppState dynamically
  try {
    // eslint-disable-next-line global-require
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

  // Subscribe to AppState changes
  const subscription = appState.addEventListener("change", (newState: AppStateStatus) => {
    currentState = newState
    const nowFocused = newState === "active"

    if (isFocused !== nowFocused) {
      isFocused = nowFocused
      notifySubscribers(nowFocused)
    }
  })

  const subscribers = new Set<(isFocused: boolean) => void>()

  function notifySubscribers(focused: boolean) {
    subscribers.forEach(handler => {
      try {
        handler(focused)
      } catch {
        // Suppress handler errors to avoid breaking the app
      }
    })
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
      handler(isFocused)

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
