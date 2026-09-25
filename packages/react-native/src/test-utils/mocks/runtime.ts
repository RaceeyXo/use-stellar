/**
 * Runtime Reset Utilities
 * ──────────────────────
 * Centralizes cleanup of all mock state between tests.
 * 
 * This module coordinates resetting:
 * - AppState listeners and current state
 * - NetInfo listeners and connectivity state
 * - AsyncStorage contents
 * - Linking opened URLs
 * - WalletConnect session
 * - All jest.fn() mocks
 * 
 * Called by setup.ts beforeEach to prevent test pollution.
 */

import { resetAppStateMock } from "./AppState"
import { resetNetInfoMock } from "./NetInfo"
import { resetAsyncStorageMock } from "./AsyncStorage"
import { resetLinkingMock } from "./Linking"
import { resetWalletConnectMock } from "./WalletConnect"

/**
 * Reset all mocks and runtime state.
 * Call this before each test to ensure clean isolation.
 * 
 * This is the single point of coordination for mock cleanup —
 * add new mock reset calls here as new mocks are introduced.
 */
export function resetAllMocks(): void {
  // Reset native module mocks
  resetAppStateMock()
  resetNetInfoMock()
  resetAsyncStorageMock()
  resetLinkingMock()
  resetWalletConnectMock()

  // Reset all jest.fn() instances globally
  jest.clearAllMocks()
}

export default resetAllMocks
