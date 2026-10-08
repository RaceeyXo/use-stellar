/**
 * Connectivity Acceptance Test
 * ────────────────────────────
 *
 * Demonstrates the harness in action: fetching pauses while offline and
 * resumes when connectivity returns, driven by the NetInfo mock.
 *
 * Acceptance Criteria:
 * - Fetching happens while online
 * - No fetches while offline; cached data stays visible
 * - Fetching resumes when back online
 */

import React, { useCallback, useEffect, useState } from "react"
import { Text } from "react-native"
import NetInfo from "@react-native-community/netinfo"
import { act } from "@testing-library/react-native"
import { renderWithStellar, setOnline, getNetInfoState } from "../test-utils"
import {
  createMockHorizonServer,
  TESTNET_ADDRESS_A,
} from "../../../core/src/__mocks__/@stellar/stellar-sdk"

describe("Connectivity acceptance: fetching pauses and resumes with connectivity", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  it("pauses fetching when offline and resumes when online", async () => {
    let requestFetch: () => Promise<void> = async () => {}

    /**
     * Fetches only while online and refetches on reconnect — the pattern a
     * connectivity-aware hook follows — using the harness's NetInfo mock.
     */
    function ConnectivityAwareComponent() {
      const [isOnline, setIsOnline] = useState(getNetInfoState().isConnected)
      const [fetchCount, setFetchCount] = useState(0)

      const fetchAccount = useCallback(async () => {
        if (!getNetInfoState().isConnected) return
        await mockServer.loadAccount(TESTNET_ADDRESS_A)
        setFetchCount(c => c + 1)
      }, [])
      requestFetch = fetchAccount

      useEffect(() => {
        void fetchAccount()
        return NetInfo.addEventListener(state => {
          setIsOnline(state.isConnected === true)
          if (state.isConnected) void fetchAccount()
        })
      }, [fetchAccount])

      return (
        <>
          <Text testID="connectivity-status">{isOnline ? "Online" : "Offline"}</Text>
          <Text testID="fetch-count">Fetches: {fetchCount}</Text>
        </>
      )
    }

    const { getByTestId } = renderWithStellar(<ConnectivityAwareComponent />)
    await act(async () => {})

    expect(getByTestId("connectivity-status")).toHaveTextContent("Online")
    expect(getByTestId("fetch-count")).toHaveTextContent("Fetches: 1")

    // Go offline: fetch attempts are skipped, the last result stays visible
    act(() => setOnline(false))
    expect(getByTestId("connectivity-status")).toHaveTextContent("Offline")
    await act(() => requestFetch())
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)
    expect(getByTestId("fetch-count")).toHaveTextContent("Fetches: 1")

    // Go back online: fetching resumes
    await act(async () => setOnline(true))
    expect(getByTestId("connectivity-status")).toHaveTextContent("Online")
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)
    expect(getByTestId("fetch-count")).toHaveTextContent("Fetches: 2")
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
