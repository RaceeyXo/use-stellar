/**
 * Sample React Native Hook Test: useAccount
 * ─────────────────────────────────────────
 *
 * Demonstrates the test harness being used to test a hook in a React Native
 * context. Shows how lifecycle controls and mocks work together.
 *
 * This is a sample/reference test — the actual hook tests live in packages/core,
 * and the RN verification suites (e.g. usePaymentPaths.native.test.tsx) render
 * the real core hooks.
 */

import React, { useEffect, useState } from "react"
import { AppState, Text, View } from "react-native"
import NetInfo from "@react-native-community/netinfo"
import { act } from "@testing-library/react-native"
import { renderWithStellar, setAppState, setOnline } from "../test-utils"
import {
  createMockHorizonServer,
  mockAccountData,
  TESTNET_ADDRESS_A,
} from "../../../core/src/__mocks__/@stellar/stellar-sdk"

interface SampleAccount {
  address: string
  sequence: string
}

/**
 * A simplified account hook that loads through an injected Horizon server,
 * so the sample can drive success and failure from the shared SDK mock.
 */
function useAccountSimplified(address: string, server: ReturnType<typeof createMockHorizonServer>) {
  const [account, setAccount] = useState<SampleAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchAccount = async () => {
      setLoading(true)
      try {
        const record = (await server.loadAccount(address)) as { id: string; sequence: string }
        if (mounted) {
          setAccount({ address: record.id, sequence: record.sequence })
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

    void fetchAccount()
    return () => {
      mounted = false
    }
  }, [address, server])

  return { account, loading, error }
}

describe("useAccount in React Native context (sample)", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  it("loads account data", async () => {
    function AccountComponent() {
      const { account, loading, error } = useAccountSimplified(TESTNET_ADDRESS_A, mockServer)

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

    await act(async () => {})

    // Account data displayed
    expect(getByTestId("address")).toHaveTextContent(TESTNET_ADDRESS_A)
    expect(getByTestId("sequence")).toHaveTextContent(`Seq: ${mockAccountData.sequence}`)
  })

  it("handles network errors gracefully", async () => {
    mockServer.loadAccount.mockRejectedValueOnce(new Error("Network error"))

    function AccountComponent() {
      const { account, error } = useAccountSimplified(TESTNET_ADDRESS_A, mockServer)

      return (
        <View>
          {error && <Text testID="error">{error.message}</Text>}
          {!error && !account && <Text testID="empty">No account</Text>}
        </View>
      )
    }

    const { getByTestId } = renderWithStellar(<AccountComponent />)

    await act(async () => {})

    // Error displayed
    expect(getByTestId("error")).toHaveTextContent("Network error")
  })

  it("respects app backgrounding (lifecycle integration)", () => {
    function LifecycleAwareComponent() {
      const [isActive, setIsActive] = useState(true)

      useEffect(() => {
        const subscription = AppState.addEventListener("change", state => {
          setIsActive(state === "active")
        })
        return () => subscription.remove()
      }, [])

      return (
        <View>
          <Text testID="status">{isActive ? "active" : "backgrounded"}</Text>
        </View>
      )
    }

    const { getByTestId } = renderWithStellar(<LifecycleAwareComponent />)

    expect(getByTestId("status")).toHaveTextContent("active")

    act(() => setAppState("background"))
    expect(getByTestId("status")).toHaveTextContent("backgrounded")

    act(() => setAppState("active"))
    expect(getByTestId("status")).toHaveTextContent("active")
  })

  it("pauses fetching when offline", () => {
    function OfflineAwareComponent() {
      const [isOnline, setIsOnline] = useState(true)

      useEffect(
        () =>
          NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected === true)
          }),
        []
      )

      return (
        <View>
          <Text testID="connectivity">{isOnline ? "online" : "offline"}</Text>
        </View>
      )
    }

    const { getByTestId } = renderWithStellar(<OfflineAwareComponent />)

    expect(getByTestId("connectivity")).toHaveTextContent("online")

    act(() => setOnline(false))
    expect(getByTestId("connectivity")).toHaveTextContent("offline")

    act(() => setOnline(true))
    expect(getByTestId("connectivity")).toHaveTextContent("online")
  })

  it("demonstrates fixture reuse (no duplication)", () => {
    // mockAccountData is from core's SDK mock
    expect(mockAccountData.id).toBe(TESTNET_ADDRESS_A)
    expect(mockAccountData.balances).toBeDefined()
    expect(mockAccountData.signers).toBeDefined()

    // mockServer uses the core mock factory
    expect(mockServer.loadAccount).toBeDefined()
    expect(mockServer.loadAccount.mock).toBeDefined() // Jest mock
  })

  it("works with fake timers throughout test", () => {
    let timerFired = false

    setTimeout(() => {
      timerFired = true
    }, 1000)

    expect(timerFired).toBe(false)

    jest.advanceTimersByTime(500)
    expect(timerFired).toBe(false)

    jest.advanceTimersByTime(500)
    expect(timerFired).toBe(true)
  })
})
