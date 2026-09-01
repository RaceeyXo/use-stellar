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

const TEST_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"

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

      const lastUpdatedBeforeFailure = result.current.lastUpdated

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

      // Stale-while-revalidate: the failed refetch keeps the last known-good
      // balances and lastUpdated in place, and only surfaces the error.
      expect(result.current.balance).toBe("100.0000000")
      expect(result.current.balances).not.toEqual([])
      expect(result.current.lastUpdated).toBe(lastUpdatedBeforeFailure)
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.isStale).toBe(true)
    })
  })

  describe("stale-while-revalidate", () => {
    it("clears balances immediately when the address changes, before the new fetch resolves", async () => {
      let resolveSecond: (value: typeof mockAccountData) => void = () => {}
      const promise2 = new Promise<typeof mockAccountData>(resolve => {
        resolveSecond = resolve
      })
      mockServer.loadAccount.mockResolvedValueOnce(mockAccountData).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ address }) => useBalance({ address }), {
        initialProps: { address: TEST_ADDRESS },
        wrapper,
      })

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.balance).toBe("100.0000000")

      const NEW_ADDRESS = "GBAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"
      rerender({ address: NEW_ADDRESS })

      // Cleared synchronously — before the new fetch has resolved.
      expect(result.current.balances).toEqual([])
      expect(result.current.balance).toBeNull()
      expect(result.current.lastUpdated).toBeNull()

      await act(async () => {
        resolveSecond({ ...mockAccountData, id: NEW_ADDRESS })
      })

      expect(result.current.loading).toBe(false)
    })

    it("clears error and refreshes data on a subsequent successful poll", async () => {
      mockServer.loadAccount.mockRejectedValueOnce(new Error("Network Error"))
      mockServer.loadAccount.mockResolvedValueOnce(mockAccountData)

      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS, watch: true }), {
        wrapper,
      })

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      expect(result.current.balances).toEqual([])

      act(() => {
        result.current.refetch()
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBeNull()
      expect(result.current.balance).toBe("100.0000000")
      expect(result.current.isStale).toBe(false)
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

      const NEW_ADDRESS = "GBAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"
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

    it("should settle loading to false when the address is cleared mid-flight (wallet disconnect)", async () => {
      let resolveFirst: (value: typeof mockAccountData) => void = () => {}
      const promise1 = new Promise(resolve => {
        resolveFirst = resolve
      })
      mockServer.loadAccount.mockReturnValueOnce(promise1)

      const { result, rerender } = renderHook(({ address }) => useBalance({ address }), {
        initialProps: { address: TEST_ADDRESS as string | null },
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      // Simulate a wallet disconnect mid-flight: address goes away.
      rerender({ address: null })

      expect(result.current.loading).toBe(false)

      await act(async () => {
        resolveFirst(mockAccountData)
      })

      // The superseded (now-addressless) fetch must not resurrect loading.
      expect(result.current.loading).toBe(false)
    })
  })
})
