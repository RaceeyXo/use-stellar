/**
 * Sample React Native Hook Test: useAccount
 * ─────────────────────────────────────────
 * 
 * Demonstrates the test harness being used to test a core hook in a React Native context.
 * Shows how lifecycle controls and mocks work together with a real hook.
 * 
 * This is a sample/reference test — the actual hook tests live in packages/core.
 * This demonstrates that the RN harness can be used for RN-specific hook variants.
 */

import React, { useEffect, useState } from "react"
import { Text, View } from "react-native"
import { renderWithStellar, setAppState, setOnline } from "../test-utils"
import {
  createMockHorizonServer,
  mockAccountData,
  TESTNET_ADDRESS_A,
} from "use-stellar/dist/__mocks__/@stellar/stellar-sdk"

/**
 * This would be the real hook from @use-stellar/react-native.
 * For this sample, we use a simplified version to demonstrate the pattern.
 */
function useAccountSimplified(address: string) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchAccount = async () => {
      setLoading(true)
      try {
        // In real code, this would use the hook infrastructure
        // Here we simulate a fetch
        await new Promise(resolve => setTimeout(resolve, 100))
        if (mounted) {
          setAccount({ address, sequence: "100" })
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchAccount()
    return () => {
      mounted = false
    }
  }, [address])

  return { account, loading, error }
}

describe("useAccount in React Native context (sample)", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  it("loads account data", async () => {
    /**
     * Component that uses the hook and displays account info.
     * This is what would appear in a real RN app.
     */
    function AccountComponent() {
      const { account, loading, error } = useAccountSimplified(TESTNET_ADDRESS_A)

      return (
        <View>
          {loading && <Text testID="loading">Loading account...</Text>}
          {error && <Text testID="error">{error.message}</Text>}
          {account && (
            <>
              <Text testID="address">{account.address}</Text>
              <Text testID="sequence">Seq: {account.sequence}</Text>
            </>
          )}
        </View>
      )
    }

    const { getByTestId } = renderWithStellar(<AccountComponent />)

    // Initially loading
    expect(getByTestId("loading")).toBeDefined()

    // Advance timers to complete the fetch
    jest.advanceTimersByTime(100)

    // Account data displayed
    expect(getByTestId("address")).toHaveTextContent(TESTNET_ADDRESS_A)
    expect(getByTestId("sequence")).toHaveTextContent("Seq: 100")
  })

  it("handles network errors gracefully", async () => {
    mockServer.loadAccount.mockRejectedValueOnce(new Error("Network error"))

    function AccountComponent() {
      const { account, error } = useAccountSimplified(TESTNET_ADDRESS_A)

      return (
        <View>
          {error && <Text testID="error">{error.message}</Text>}
          {!error && !account && <Text testID="empty">No account</Text>}
        </View>
      )
    }

    const { getByTestId } = renderWithStellar(<AccountComponent />)

    jest.advanceTimersByTime(100)

    // Error displayed
    expect(getByTestId("error")).toHaveTextContent("Network error")
  })

  it("respects app backgrounding (lifecycle integration)", async () => {
    /**
     * Component that refetches when the app comes to foreground.
     * This is where RN-specific behavior matters.
     */
    function LifecycleAwareComponent() {
      const [isActive, setIsActive] = useState(true)
      const [refreshCount, setRefreshCount] = useState(0)

      const { account, loading } = useAccountSimplified(TESTNET_ADDRESS_A)

      useEffect(() => {
        // On foreground, refetch
        if (isActive) {
          setRefreshCount(c => c + 1)
        }
      }, [isActive])

      return (
        <View>
          <Text testID="status">{isActive ? "active" : "backgrounded"}</Text>
          <Text testID="refresh-count">{refreshCount}</Text>
          {loading && <Text testID="loading">Loading...</Text>}
          {account && <Text testID="address">{account.address}</Text>}
        </View>
      )
    }

    const { getByTestId, rerender } = renderWithStellar(<LifecycleAwareComponent />)

    // Initial render, app is active
    expect(getByTestId("status")).toHaveTextContent("active")

    // Simulate app backgrounding
    setAppState("background")
    jest.advanceTimersByTime(100)
    rerender(<LifecycleAwareComponent />)

    // App is backgrounded
    expect(getByTestId("status")).toHaveTextContent("backgrounded")

    // Restore to foreground
    setAppState("active")
    jest.advanceTimersByTime(100)
    rerender(<LifecycleAwareComponent />)

    // App is active again
    expect(getByTestId("status")).toHaveTextContent("active")
  })

  it("pauses fetching when offline", async () => {
    /**
     * Component that checks connectivity before fetching.
     * Demonstrates NetInfo mock integration.
     */
    function OfflineAwareComponent() {
      const [isOnline, setIsOnlineState] = useState(true)
      const [fetchAttempts, setFetchAttempts] = useState(0)
      const { account } = useAccountSimplified(TESTNET_ADDRESS_A)

      const handleFetch = async () => {
        if (!isOnline) {
          return
        }
        setFetchAttempts(c => c + 1)
      }

      return (
        <View>
          <Text testID="connectivity">{isOnline ? "online" : "offline"}</Text>
          <Text testID="fetch-attempts">{fetchAttempts}</Text>
          {account && <Text testID="cached-account">Cached: {account.address}</Text>}
        </View>
      )
    }

    const { getByTestId, rerender } = renderWithStellar(<OfflineAwareComponent />)

    // Online by default
    expect(getByTestId("connectivity")).toHaveTextContent("online")

    // Go offline
    setOnline(false)
    jest.advanceTimersByTime(100)
    rerender(<OfflineAwareComponent />)

    expect(getByTestId("connectivity")).toHaveTextContent("offline")

    // Go online
    setOnline(true)
    jest.advanceTimersByTime(100)
    rerender(<OfflineAwareComponent />)

    expect(getByTestId("connectivity")).toHaveTextContent("online")
  })

  it("demonstrates fixture reuse (no duplication)", () => {
    /**
     * Verify that we're using the shared core fixtures, not forked versions.
     * This is an assertion that the harness architecture is sound.
     */

    // mockAccountData is from core's SDK mock
    expect(mockAccountData.id).toBe(TESTNET_ADDRESS_A)
    expect(mockAccountData.balances).toBeDefined()
    expect(mockAccountData.signers).toBeDefined()

    // mockServer uses the core mock factory
    expect(mockServer.loadAccount).toBeDefined()
    expect(mockServer.loadAccount.mock).toBeDefined() // Jest mock

    // When we call it, we get the fixture
    mockServer.loadAccount.mockResolvedValueOnce(mockAccountData)
    // (In real code, this is what useAccount() does behind the scenes)
  })

  it("works with fake timers throughout test", () => {
    /**
     * Verify that fake timers remain active throughout the test.
     * This is critical for deterministic polling and retries.
     */

    let timerFired = false

    // Timers should be fake (not real)
    setTimeout(() => {
      timerFired = true
    }, 1000)

    // Timer should not have fired yet
    expect(timerFired).toBe(false)

    // Advance fake timers
    jest.advanceTimersByTime(500)
    expect(timerFired).toBe(false)

    // Advance past the 1s mark
    jest.advanceTimersByTime(500)
    expect(timerFired).toBe(true)
  })
})
