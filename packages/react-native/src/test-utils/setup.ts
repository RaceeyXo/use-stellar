/**
 * React Native Jest Setup File
 * ────────────────────────────
 * Runs once per test file, before any tests execute.
 * 
 * Responsibilities:
 * 1. Enable fake timers globally for deterministic polling/retry behavior
 * 2. Configure mock reset hooks to prevent test pollution
 * 3. Set up global test environment defaults
 * 4. Register mock cleanup between tests
 */

import { resetAllMocks } from "./mocks/runtime"

// ── Fake Timers ──────────────────────────────────────────────────────
// Enable fake timers globally for all tests in this package.
// This ensures deterministic polling, retries, and lifecycle events.
jest.useFakeTimers()

// ── Global Test Lifecycle ────────────────────────────────────────────
beforeEach(() => {
  // Reset all mock state and runtime before each test
  resetAllMocks()
})

afterEach(() => {
  // Clear any pending timers after each test
  jest.clearAllTimers()
})
