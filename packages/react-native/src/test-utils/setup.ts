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

import "@testing-library/react-native/extend-expect"
import { resetAllMocks } from "./mocks/runtime"

// ── React Native runtime identity ────────────────────────────────────
// The RN JS runtime sets `navigator.product` to "ReactNative" and has no
// `window` or `document`. Jest runs these suites in plain Node (no jsdom), so
// only the navigator identity needs to be recreated here.
Object.defineProperty(globalThis, "navigator", {
  value: { product: "ReactNative" },
  configurable: true,
  writable: true,
})

// ── Fake Timers ──────────────────────────────────────────────────────
// Enable fake timers globally for all tests in this package.
// This ensures deterministic polling, retries, and lifecycle events.
jest.useFakeTimers()

beforeEach(() => {
  resetAllMocks()
})

afterEach(() => {
  jest.clearAllTimers()
})
