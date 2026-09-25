/**
 * @use-stellar/react-native Test Utilities
 * ────────────────────────────────────────
 * Shared testing infrastructure for React Native tests.
 * 
 * Exports:
 * - renderWithStellar() — test renderer with provider setup
 * - Mock lifecycle control helpers (setAppState, setOnline, openUrl, etc.)
 * - Mock state inspection helpers
 * - Automatic mock reset between tests
 * 
 * @example
 * import { renderWithStellar, setAppState, setOnline } from "@use-stellar/react-native/test-utils"
 * 
 * it("pauses polling when backgrounded", async () => {
 *   renderWithStellar(<MyComponent />)
 *   
 *   await waitFor(() => expect(mockServer.loadAccount).toHaveBeenCalled())
 *   setAppState("background")
 *   
 *   const beforeCount = mockServer.loadAccount.mock.calls.length
 *   jest.advanceTimersByTime(5000)
 *   expect(mockServer.loadAccount).toHaveBeenCalledTimes(beforeCount)
 * })
 */

// Test renderer
export { renderWithStellar, TestText, TestError, TestLoading, TestContainer } from "./render"
export type { RenderWithStellarOptions } from "./render"

// Mock lifecycle and state inspection helpers
export * from "./mocks/index"

// Re-export core SDK fixtures for test reuse
// Tests should import fixtures from core, not duplicate them
// @example import { mockAccountData } from "use-stellar/dist/__mocks__/@stellar/stellar-sdk"
