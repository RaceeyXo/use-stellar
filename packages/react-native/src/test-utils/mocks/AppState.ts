/**
 * React Native AppState Mock
 * ──────────────────────────
 * Provides a controllable mock of React Native's AppState module.
 * 
 * Enables tests to simulate app lifecycle transitions:
 * - active → background (suspension)
 * - background → active (resume)
 * 
 * The mock tracks listeners and emits state changes when setAppState() is called.
 * Tests can assert that polling pauses when the app backgrounded.
 */

type AppStateStatus = "active" | "background" | "inactive" | "unknown" | "extension"

interface AppStateListener {
  (state: AppStateStatus): void
}

interface MockAppState {
  currentAppState: AppStateStatus
  listeners: Set<AppStateListener>
  addEventListener(type: "change", listener: AppStateListener): { remove(): void }
  removeEventListener(type: "change", listener: AppStateListener): void
  reset(): void
}

/**
 * Singleton mock instance for AppState.
 * Tests interact with this via setAppState() helper.
 */
const mockAppState: MockAppState = {
  currentAppState: "active",
  listeners: new Set(),

  addEventListener(type: "change", listener: AppStateListener) {
    if (type === "change") {
      this.listeners.add(listener)
    }
    return {
      remove: () => {
        this.listeners.delete(listener)
      },
    }
  },

  removeEventListener(type: "change", listener: AppStateListener) {
    if (type === "change") {
      this.listeners.delete(listener)
    }
  },

  reset() {
    this.currentAppState = "active"
    this.listeners.clear()
  },
}

/**
 * Helper to change app state and notify all listeners.
 * 
 * Called from test helpers to simulate:
 * - User minimizing the app → "background"
 * - User returning to the app → "active"
 * 
 * @example
 * setAppState("background") // Pauses polling
 * setAppState("active")     // Resumes polling
 */
export function setAppState(state: AppStateStatus): void {
  mockAppState.currentAppState = state
  // Emit change to all registered listeners
  mockAppState.listeners.forEach(listener => {
    listener(state)
  })
}

/**
 * Get the current app state.
 * Used by tests to verify state transitions.
 */
export function getAppState(): AppStateStatus {
  return mockAppState.currentAppState
}

/**
 * Get count of registered listeners (for test assertions).
 */
export function getAppStateListenerCount(): number {
  return mockAppState.listeners.size
}

/**
 * Clear all listeners and reset to active.
 * Called by setup.ts beforeEach.
 */
export function resetAppStateMock(): void {
  mockAppState.reset()
}

export default mockAppState
