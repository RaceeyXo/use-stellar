// packages/core/src/hooks/usePaymentHistory.test.tsx

import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { usePaymentHistory } from "./usePaymentHistory"
import { StellarProvider } from "../context/StellarProvider"

const TESTNET_ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASUIYIC7FEM"

// Mock the underlying usePayments hook
jest.mock("./usePayments", () => {
  let hasNext = true
  let payments: any[] = []
  
  return {
    usePayments: jest.fn(() => ({
      payments,
      loading: false,
      error: null,
      hasNext,
      fetchNext: jest.fn(() => {
        // Mock paging behavior defined per test
      }),
    })),
    __setMockPayments: (newPayments: any[], newHasNext: boolean) => {
      payments = newPayments
      hasNext = newHasNext
    }
  }
})

import { usePayments } from "./usePayments"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

describe("usePaymentHistory", () => {
  const { __setMockPayments } = require("./usePayments")

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("filters by direction properly", async () => {
    __setMockPayments([
      { id: "1", direction: "incoming", asset: "XLM" },
      { id: "2", direction: "outgoing", asset: "XLM" },
    ], false)

    const { result } = renderHook(
      () => usePaymentHistory({ address: TESTNET_ACCOUNT, direction: "incoming" }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments.length).toBe(1)
    expect(result.current.payments[0].id).toBe("1")
  })

  it("filters by asset and maintains identity stability for inline objects", async () => {
    const inlineAsset = { code: "USDC", issuer: "G_TEST_ISSUER" }
    
    __setMockPayments([
      { id: "1", asset: "XLM", direction: "incoming" },
      { id: "2", asset: { code: "USDC", issuer: "G_TEST_ISSUER" }, direction: "incoming" },
    ], false)

    const { result, rerender } = renderHook(
      () => usePaymentHistory({ address: TESTNET_ACCOUNT, asset: inlineAsset }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments.length).toBe(1)
    expect(result.current.payments[0].id).toBe("2")

    const initialPaymentsRef = result.current.payments
    
    // Rerender with a NEW inline object reference that has the same primitive values
    rerender({ address: TESTNET_ACCOUNT, asset: { code: "USDC", issuer: "G_TEST_ISSUER" } })
    
    expect(result.current.payments).toBe(initialPaymentsRef) // Identity stability maintained
  })

  it("does not disable hasNext when a page has zero matches", async () => {
    __setMockPayments([
      { id: "1", direction: "outgoing", asset: "XLM" },
    ], true) // hasNext is true, but no incoming payments

    const { result } = renderHook(
      () => usePaymentHistory({ address: TESTNET_ACCOUNT, direction: "incoming" }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments.length).toBe(0)
    expect(result.current.hasNext).toBe(true) // Should remain true, allowing fetchNext
  })

  it("observes the per-call request bound when accumulating", async () => {
    const mockFetchNext = jest.fn()
    ;(usePayments as jest.Mock).mockReturnValue({
      payments: [{ id: "1", direction: "outgoing", asset: "XLM" }], // zero matches for 'incoming'
      loading: false,
      error: null,
      hasNext: true,
      fetchNext: mockFetchNext,
    })

    const { result } = renderHook(
      () => usePaymentHistory({ 
        address: TESTNET_ACCOUNT, 
        direction: "incoming",
        maxAccumulationPages: 3 // bound to 3 pages
      }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.accumulationBoundHit).toBe(true))
    
    // The loop should break and flag accumulationBoundHit rather than looping forever
    expect(result.current.payments.length).toBe(0)
    expect(result.current.hasNext).toBe(true)
    expect(mockFetchNext).toHaveBeenCalledTimes(2) // Initial page counts as 1, calls fetchNext 2 times to hit 3
  })
})
