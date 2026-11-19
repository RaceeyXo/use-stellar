/**
 * AppState-based focus manager for React Native.
 *
 * Integrates with React Native's AppState to track whether the app is in the
 * foreground or background. Used by polling hooks to pause requests while the
 * app is backgrounded and resume on foreground.
 *
 * Falls back to "always focused" if AppState is unavailable.
 */

import { AppState } from "react-native"

type AppStateStatus = "active" | "background" | "inactive" | "unknown" | "extension"

type AppStateLike = {
  currentState: AppStateStatus
  addEventListener: (
    event: "change",
    handler: (state: AppStateStatus) => void
  ) => { remove?: () => void } | void
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

/** Returns React Native's AppState, or `null` outside a React Native runtime. */
export function loadAppState(): AppStateLike | null {
  const appState = AppState as unknown as AppStateLike | undefined
  return appState && typeof appState.addEventListener === "function" ? appState : null
}

/**
 * Creates a focus manager backed by React Native's AppState.
 *
 * Calls the handler immediately with the current state, then again whenever
 * the app foreground/background state changes.
 *
 * The AppState listener is attached with the first subscriber and removed with
 * the last, so creating a manager (or remounting the provider that owns one)
 * never leaves a native listener behind.
 *
 * If AppState is unavailable (e.g. a non-RN environment), returns a fallback
 * manager that is always focused.
 */
export function createAppStateFocusManager(): FocusManager {
  const appState = loadAppState()
  if (!appState) return createAlwaysFocusedManager()

  const subscribers = new Set<(isFocused: boolean) => void>()
  let subscription: { remove?: () => void } | void
  let focused = true

  function read(): boolean {
    try {
      return appState!.currentState === "active"
    } catch {
      return true
    }
  }

  function safeCall(handler: (isFocused: boolean) => void, value: boolean) {
    try {
      handler(value)
    } catch {
      // Suppress handler errors to avoid breaking the app
    }
  }

  function attach() {
    focused = read()
    try {
      subscription = appState!.addEventListener("change", (state: AppStateStatus) => {
        const nowFocused = state === "active"
        if (focused === nowFocused) return
        focused = nowFocused
        subscribers.forEach(handler => safeCall(handler, nowFocused))
      })
    } catch {
      // Keep reporting the state read above rather than breaking the provider.
    }
  }

  function detach() {
    if (subscription && typeof subscription.remove === "function") subscription.remove()
    subscription = undefined
  }

  return {
    // With no listener attached the cached value can be stale, so ask AppState.
    isFocused: () => (subscribers.size > 0 ? focused : read()),
    subscribe: (handler: (isFocused: boolean) => void) => {
      subscribers.add(handler)
      if (subscribers.size === 1) attach()
      // Immediately notify with current state
      safeCall(handler, focused)

      return () => {
        subscribers.delete(handler)
        if (subscribers.size === 0) detach()
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
