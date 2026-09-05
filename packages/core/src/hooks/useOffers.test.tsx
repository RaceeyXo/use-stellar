// packages/core/src/hooks/useOffers.test.tsx

import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useOffers } from "./useOffers"
import { StellarProvider } from "../context/StellarProvider"

const TESTNET_ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASUIYIC7FEM"

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn()
}))

import { getHorizonServer } from "../utils"

const mockCall = jest.fn()
const mockNext = jest.fn()
const mockPrev = jest.fn()
const mockOffers = jest.fn(() => ({
  forAccount: () => ({ limit: () => ({ order: () => ({ cursor: () => ({ call: mockCall }), call: mockCall }) }) })
}))

;(getHorizonServer as jest.Mock).mockReturnValue({ offers: mockOffers })

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

describe("useOffers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("reads an account's open offers with working pagination", async () => {
    mockCall.mockResolvedValueOnce({
      records: [{
        id: 100, seller: TESTNET_ACCOUNT, amount: "10", price: "2", price_r: { n: 2, d: 1 },
        selling: { asset_type: "native" }, buying: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GABC" }
      }],
      next: mockNext, prev: mockPrev
    })

    mockNext.mockResolvedValueOnce({
      records: [{
        id: 101, seller: TESTNET_ACCOUNT, amount: "5", price: "1", price_r: { n: 1, d: 1 },
        selling: { asset_type: "native" }, buying: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GABC" }
      }],
      next: mockNext, prev: mockPrev
    })

    const { result } = renderHook(() => useOffers({ address: TESTNET_ACCOUNT, limit: 1 }), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.offers.length).toBe(1)
    expect(result.current.offers[0].id).toBe("100")
    expect(result.current.hasNext).toBe(true)

    await act(async () => {
      await result.current.fetchNext()
    })
    
    expect(result.current.offers[0].id).toBe("101")
    expect(mockNext).toHaveBeenCalled()
  })
})