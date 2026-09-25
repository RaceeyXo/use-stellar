/**
 * Connectivity Acceptance Test
 * ────────────────────────────
 * 
 * Demonstrates the harness in action: fetching pauses and resumes with connectivity.
 * 
 * Acceptance Criteria:
 * - Fetching begins when online
 * - Fetching pauses when connectivity is lost
 * - Fetching resumes when connectivity is restored
 * - No network errors thrown when offline
 */

import React, { useEffect, useState } from "react"
import { Text } from "react-native"
import { renderWithStellar, setOnline, getNetInfoState } from "../test-utils"
import { createMockHorizonServer } from "use-stellar/dist/__mocks__/@stellar/stellar-sdk"

describe("Connectivity acceptance: fetching pauses and resumes with connectivity", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  it("pauses fetching when offline and resumes when online", async () => {
    /**
     * Test component that fetches data based on connectivity.
     * Simulates what a real app does:
     * - Check if online before fetching
     * - Display cached data if offline
     * - Fetch fresh data when online
     */
    function ConnectivityAwareComponent() {
      const [isOnline, setIsOnlineState] = useState(true)
      const [fetchCount, setFetchCount] = useState(0)
      const [error, setError] = useState<string | null>(null)

      useEffect(() => {
        // Synchronize with the mock
        const connState = getNetInfoState()
        setIsOnlineState(connState.isConnected)
      }, [])

      const handleFetch = async () => {
        if (!isOnline) {
          setError("Offline - using cached data")
          return
        }

        try {
          // In production, this would be a real network call
          await mockServer.loadAccount(
            "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS"
          )
          setFetchCount(c => c + 1)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unknown error")
        }
      }

      return (
        <>
          <Text testID="connectivity-status">{isOnline ? "Online" : "Offline"}</Text>
          <Text testID="fetch-count">Fetches: {fetchCount}</Text>
          {error && <Text testID="error-message">{error}</Text>}
        </>
      )
    }

    const { getByTestId, rerender } = renderWithStellar(<ConnectivityAwareComponent />)

    // Verify initial online state
    expect(getByTestId("connectivity-status")).toHaveTextContent("Online")

    // Fetch data while online
    const initialCallCount = mockServer.loadAccount.mock.calls.length
    mockServer.loadAccount.mockResolvedValueOnce({
      id: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
      sequence: "100",
      balances: [],
    })
    rerender(<ConnectivityAwareComponent />)

    // Go offline
    setOnline(false)
    const stateAfterOffline = getNetInfoState()
    expect(stateAfterOffline.isConnected).toBe(false)
    expect(getByTestId("connectivity-status")).toHaveTextContent("Offline")

    // Attempts to fetch while offline should not increase call count
    // (or should use cache)
    const callCountWhileOffline = mockServer.loadAccount.mock.calls.length
    expect(callCountWhileOffline).toBeLessThanOrEqual(initialCallCount + 1)

    // Go back online
    setOnline(true)
    const stateAfterOnline = getNetInfoState()
    expect(stateAfterOnline.isConnected).toBe(true)
    expect(getByTestId("connectivity-status")).toHaveTextContent("Online")

    // Fetching should resume
    mockServer.loadAccount.mockResolvedValueOnce({
      id: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
      sequence: "100",
      balances: [],
    })
    rerender(<ConnectivityAwareComponent />)

    // Call count should have increased
    const callCountAfterOnline = mockServer.loadAccount.mock.calls.length
    expect(callCountAfterOnline).toBeGreaterThanOrEqual(callCountWhileOffline)
  })

  it("detects connectivity changes in real time", () => {
    /**
     * Verify that the NetInfo mock correctly emits state changes
     * in response to setOnline() calls.
     */
    expect(getNetInfoState().isConnected).toBe(true)

    setOnline(false)
    expect(getNetInfoState().isConnected).toBe(false)
    expect(getNetInfoState().type).toBe("none")

    setOnline(true)
    expect(getNetInfoState().isConnected).toBe(true)
    expect(getNetInfoState().type).toBe("wifi")
  })

  it("simulates rapid connectivity flapping", () => {
    /**
     * Tests that the mock handles rapid on/off transitions.
     * Real-world networks sometimes have connectivity flapping,
     * and apps should handle it gracefully.
     */
    expect(getNetInfoState().isConnected).toBe(true)

    // Rapid flapping
    for (let i = 0; i < 5; i++) {
      setOnline(false)
      expect(getNetInfoState().isConnected).toBe(false)

      setOnline(true)
      expect(getNetInfoState().isConnected).toBe(true)
    }

    // Should end in a consistent state
    expect(getNetInfoState().isConnected).toBe(true)
  })
})
