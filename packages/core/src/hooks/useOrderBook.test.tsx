// packages/core/src/hooks/useOrderbook.test.tsx

import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useOrderbook } from "./useOrderbook"
import { StellarProvider } from "../context/StellarProvider"

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn()
}))

import { getHorizonServer } from "../utils"

const mockCall = jest.fn()
const mockOrderbook = jest.fn(() => ({
  limit: () => ({ call: mockCall })
}))

;(getHorizonServer as jest.Mock).mockReturnValue({ orderbook: mockOrderbook })

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

describe("useOrderbook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("fetches a populated order book and calculates exact rational spread and midPrice", async () => {
    // Bid: 1/2 (0.50), Ask: 3/4 (0.75)
    // Spread should be 1/4 (0.25). MidPrice should be 5/8 (0.625).
    mockCall.mockResolvedValueOnce({
      bids: [{ price: "0.5000000", amount: "100", price_r: { n: 1, d: 2 } }],
      asks: [{ price: "0.7500000", amount: "100", price_r: { n: 3, d: 4 } }]
    })

    const { result } = renderHook(() => useOrderbook({ selling: "XLM", buying: { code: "USDC", issuer: "G123" } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bids.length).toBe(1)
    expect(result.current.asks.length).toBe(1)
    expect(result.current.spread).toBe("0.25")
    expect(result.current.midPrice).toBe("0.625")
  })

  it("returns null for spread and midPrice if either side is empty", async () => {
    mockCall.mockResolvedValueOnce({
      bids: [{ price: "0.5000000", amount: "100", price_r: { n: 1, d: 2 } }],
      asks: []
    })

    const { result } = renderHook(() => useOrderbook({ selling: "XLM", buying: { code: "USDC", issuer: "G123" } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bids.length).toBe(1)
    expect(result.current.asks.length).toBe(0)
    expect(result.current.spread).toBeNull()
    expect(result.current.midPrice).toBeNull()
  })

  it("returns null for spread and midPrice if the book is entirely empty", async () => {
    mockCall.mockResolvedValueOnce({ bids: [], asks: [] })

    const { result } = renderHook(() => useOrderbook({ selling: "XLM", buying: { code: "USDC", issuer: "G123" } }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.spread).toBeNull()
    expect(result.current.midPrice).toBeNull()
  })

  it("respects enabled: false and does not issue requests", async () => {
    renderHook(() => useOrderbook({ selling: "XLM", buying: { code: "USDC", issuer: "G123" }, enabled: false }), { wrapper })
    expect(mockCall).not.toHaveBeenCalled()
  })

  it("polls in watch mode and cleans up interval on unmount", async () => {
    mockCall.mockResolvedValue({ bids: [], asks: [] })

    const { unmount } = renderHook(() => useOrderbook({ 
      selling: "XLM", buying: { code: "USDC", issuer: "G123" }, watch: true, interval: 2000 
    }), { wrapper })

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(1))

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockCall).toHaveBeenCalledTimes(2)

    unmount()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    // Interval was cleared, should still be 2
    expect(mockCall).toHaveBeenCalledTimes(2)
  })
})