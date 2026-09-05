import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useBalance } from "./useBalance"

// Mock the entire @stellar/stellar-sdk module
jest.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn(),
  },
}))

jest.mock("../utils", () => {
  const mockServer = {}
  return {
    ...jest.requireActual("../utils"),
    getHorizonServer: () => mockServer,
    __mockServer: mockServer,
  }
})

// @ts-expect-error - import mocked internal state
import { __mockServer as mockServer } from "../utils"

/**
 * A realistic Horizon 404: the SDK always throws an error carrying the
 * response, never a bare message. Classification reads the structured fields.
 */
function notFoundError() {
  const error = new Error("Request failed with status code 404") as Error & {
    response: { status: number; data: { type: string; title: string; status: number } }
  }
  error.response = {
    status: 404,
    data: {
      type: "https://stellar.org/horizon-errors/not_found",
      title: "Resource Missing",
      status: 404,
    },
  }
  return error
}

// Mock Horizon server instance
Object.assign(mockServer, {
  loadAccount: jest.fn(),
  mockError: jest.fn(),
})

// Test wrapper
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

const TEST_ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

// Mock data
const mockAccountData = {
  id: TEST_ADDRESS,
  balances: [
    {
      asset_type: "native",
      balance: "100.0000000",
    },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      balance: "250.5000000",
      limit: "1000.0000000",
    },
    {
      asset_type: "liquidity_pool_shares",
      balance: "50.0000000",
      liquidity_pool_id: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
    },
  ],
}

describe("useBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockServer.loadAccount.mockResolvedValue(mockAccountData)
    // No top-level jest.fn() with implementation that gets lost here, loadAccount is re-applied!
  })

  describe("initial loading state", () => {
    it("should start in loading state when address is provided", async () => {
      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      expect(result.current.loading).toBe(true)
      expect(result.current.balance).toBe(null)
      expect(result.current.balances).toEqual([])
      expect(result.current.error).toBe(null)
    })

    it("should not load when no address is provided", () => {
      const { result } = renderHook(() => useBalance({ address: null }), { wrapper })

      expect(result.current.loading).toBe(false)
      expect(result.current.balance).toBe(null)
      expect(result.current.balances).toEqual([])
      expect(result.current.error).toBe(null)
    })
  })

  describe("successful balance retrieval", () => {
    it("should fetch XLM balance successfully", async () => {
      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS, asset: "XLM" }), {
        wrapper,
      })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balance).toBe("100.0000000")
      expect(result.current.error).toBe(null)
      expect(result.current.balances).toHaveLength(3)

      // Verify XLM balance structure
      const xlmBalance = result.current.balances.find(b => b.asset === "XLM")
      expect(xlmBalance).toEqual({
        asset: "XLM",
        balance: "100.0000000",
      })
    })

    it("should fetch issued asset balance successfully", async () => {
      const asset = {
        code: "USDC",
        issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      }

      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS, asset }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balance).toBe("250.5000000")
      expect(result.current.error).toBe(null)

      // Verify issued asset balance structure
      const usdcBalance = result.current.balances.find(
        b => typeof b.asset === "object" && "code" in b.asset && b.asset.code === "USDC"
      )
      expect(usdcBalance).toEqual({
        asset: {
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        balance: "250.5000000",
        limit: "1000.0000000",
      })
    })

    it("should fetch liquidity pool share balance successfully", async () => {
      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(null)

      // Verify liquidity pool balance structure
      const lpBalance = result.current.balances.find(
        b => typeof b.asset === "string" && b.asset === "liquidity_pool_shares"
      )
      expect(lpBalance).toEqual({
        asset: "liquidity_pool_shares",
        balance: "50.0000000",
        liquidityPoolId: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
      })
    })

    it("should return all balance types in balances array", async () => {
      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balances).toHaveLength(3)

      // Verify all balance types are present
      const assetTypes = result.current.balances.map(b => {
        if (b.asset === "XLM") return "native"
        if (b.asset === "liquidity_pool_shares") return "liquidity_pool_shares"
        return "issued"
      })

      expect(assetTypes).toContain("native")
      expect(assetTypes).toContain("issued")
      expect(assetTypes).toContain("liquidity_pool_shares")
    })
  })

  describe("error handling", () => {
    it("should handle account not found error", async () => {
      mockServer.loadAccount.mockRejectedValue(notFoundError())

      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balance).toBe(null)
      expect(result.current.balances).toEqual([])
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
    })

    it("should handle unexpected SDK errors", async () => {
      mockServer.loadAccount.mockRejectedValue(new Error("Network Error"))

      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balance).toBe(null)
      expect(result.current.balances).toEqual([])
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
    })
  })

  describe("refetch functionality", () => {
    it("should provide refetch function that works", async () => {
      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      // Verify initial success
      expect(result.current.balance).toBe("100.0000000")
      expect(result.current.error).toBe(null)

      // Mock an error for refetch
      mockServer.loadAccount.mockRejectedValue(new Error("Network Error"))

      // Call refetch
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)
        expect(result.current.loading).toBe(false)
      })

      // Stale-while-revalidate: a failed refresh surfaces the error but keeps
      // the last known-good balance and the timestamp that marks it as stale.
      // Blanking them would strobe the display empty on every transient 429.
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.balance).toBe("100.0000000")
      expect(result.current.balances.length).toBeGreaterThan(0)
      expect(result.current.lastUpdated).toBeInstanceOf(Date)
    })
  })

  describe("stale responses and unmounting", () => {
    it("should not set state if unmounted before fetch resolves", async () => {
      let resolveFetch: (value: typeof mockAccountData) => void = () => {}
      const promise = new Promise(resolve => {
        resolveFetch = resolve
      })
      mockServer.loadAccount.mockReturnValue(promise)

      const { result, unmount } = renderHook(() => useBalance({ address: TEST_ADDRESS }), {
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      unmount()

      await act(async () => {
        resolveFetch(mockAccountData)
      })
    })

    it("should not overwrite newer results with older stale responses", async () => {
      let resolveFirst: (value: typeof mockAccountData) => void = () => {}
      let resolveSecond: (value: typeof mockAccountData) => void = () => {}

      const promise1 = new Promise(resolve => {
        resolveFirst = resolve
      })
      const promise2 = new Promise(resolve => {
        resolveSecond = resolve
      })

      mockServer.loadAccount.mockReturnValueOnce(promise1).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ address }) => useBalance({ address }), {
        initialProps: { address: TEST_ADDRESS },
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      const NEW_ADDRESS = "GBWKCJL7A6HXXPENMX6UAZGYSLAGV6MDYSZCOG2CMDJPIUOET3Q57B73"
      const secondMockData = {
        ...mockAccountData,
        id: NEW_ADDRESS,
        balances: [{ asset_type: "native", balance: "50.0000000" }],
      }

      rerender({ address: NEW_ADDRESS })

      await act(async () => {
        resolveSecond(secondMockData)
      })

      expect(result.current.balance).toBe("50.0000000")
      expect(result.current.loading).toBe(false)

      await act(async () => {
        resolveFirst(mockAccountData)
      })

      expect(result.current.balance).toBe("50.0000000")
    })
  })
})
