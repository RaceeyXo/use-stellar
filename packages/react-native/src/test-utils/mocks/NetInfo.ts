/**
 * React Native NetInfo Mock
 * ────────────────────────
 * Provides a controllable mock of @react-native-community/netinfo.
 * 
 * Enables tests to simulate network connectivity transitions:
 * - online → offline (network unavailable)
 * - offline → online (network restored)
 * 
 * The mock tracks listeners and emits connectivity state changes.
 * Tests can assert that fetching pauses when offline.
 */

export interface NetInfoState {
  isConnected: boolean
  isInternetReachable: boolean
  type: "cellular" | "wifi" | "none" | "unknown"
}

interface NetInfoListener {
  (state: NetInfoState): void
}

interface MockNetInfo {
  currentState: NetInfoState
  listeners: Set<NetInfoListener>
  fetch(): Promise<NetInfoState>
  addEventListener(listener: NetInfoListener): () => void
  removeEventListener(listener: NetInfoListener): boolean
  reset(): void
}

/**
 * Singleton mock instance for NetInfo.
 * Tests interact with this via setOnline() helper.
 */
const mockNetInfo: MockNetInfo = {
  currentState: {
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  },
  listeners: new Set(),

  async fetch(): Promise<NetInfoState> {
    return this.currentState
  },

  addEventListener(listener: NetInfoListener) {
    this.listeners.add(listener)
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  },

  removeEventListener(listener: NetInfoListener) {
    return this.listeners.delete(listener)
  },

  reset() {
    this.currentState = {
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
    }
    this.listeners.clear()
  },
}

/**
 * Helper to change network connectivity and notify all listeners.
 * 
 * Called from test helpers to simulate:
 * - Network loss → setOnline(false)
 * - Network restored → setOnline(true)
 * 
 * @example
 * setOnline(false) // Pauses fetching
 * setOnline(true)  // Resumes fetching
 */
export function setOnline(isConnected: boolean): void {
  mockNetInfo.currentState = {
    isConnected,
    isInternetReachable: isConnected,
    type: isConnected ? "wifi" : "none",
  }
  // Emit change to all registered listeners
  mockNetInfo.listeners.forEach(listener => {
    listener(mockNetInfo.currentState)
  })
}

/**
 * Get the current network state.
 * Used by tests to verify connectivity state.
 */
export function getNetInfoState(): NetInfoState {
  return mockNetInfo.currentState
}

/**
 * Get count of registered listeners (for test assertions).
 */
export function getNetInfoListenerCount(): number {
  return mockNetInfo.listeners.size
}

/**
 * Clear all listeners and reset to online.
 * Called by setup.ts beforeEach.
 */
export function resetNetInfoMock(): void {
  mockNetInfo.reset()
}

export default mockNetInfo
