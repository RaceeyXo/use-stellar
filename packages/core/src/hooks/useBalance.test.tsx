import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { useBalance } from "./useBalance"
import { getHorizonServer } from "../utils"

// Mock the Horizon server so no real network call is made. `parseHorizonBalance`
// stays real so normalized balance objects are exercised. Mirrors the mock setup
// in usePayments.test.tsx. This file merges the former useBalance.test.ts and
// useBalance.test.tsx suites so useBalance has exactly one test file.
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
}))

const mockGetHorizonServer = getHorizonServer as jest.Mock
const loadAccount = jest.fn()

const TEST_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"

// Mock data in raw Horizon format (asset_type / asset_code / asset_issuer) so
// the real parseHorizonBalance normalizes it during the fetch.
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

function wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

// A realistic Horizon 404: the SDK always throws an error carrying the
// response, never a bare message. Classification reads the structured fields.
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

// Flush the microtask queue so async state updates settle under fake timers.
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  loadAccount.mockResolvedValue(mockAccountData)
  mockGetHorizonServer.mockReturnValue({ loadAccount })
})

describe("useBalance", () => {
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
        expect(loadAccount).toHaveBeenCalled()
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
        expect(loadAccount).toHaveBeenCalled()
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
        expect(loadAccount).toHaveBeenCalled()
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
        expect(loadAccount).toHaveBeenCalled()
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

    it("exposes lastUpdated after a successful fetch", async () => {
      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })
      await flush()
      expect(result.current.lastUpdated).toBeInstanceOf(Date)
      expect(result.current.balance).toBe("100.0000000")
    })
  })

  describe("error handling", () => {
    it("should handle account not found error", async () => {
      loadAccount.mockRejectedValue(notFoundError())

      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balance).toBe(null)
      expect(result.current.balances).toEqual([])
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
    })

    it("should handle unexpected SDK errors", async () => {
      loadAccount.mockRejectedValue(new Error("Network Error"))

      const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(loadAccount).toHaveBeenCalled()
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
        expect(loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      // Verify initial success
      expect(result.current.balance).toBe("100.0000000")
      expect(result.current.error).toBe(null)

      // Mock an error for refetch
      loadAccount.mockRejectedValue(new Error("Network Error"))

      // Call refetch
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(loadAccount).toHaveBeenCalledTimes(2)
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.balances).toEqual([])
      expect(result.current.lastUpdated).toBeNull()
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
    })
  })

  describe("stale responses and unmounting", () => {
    it("should not set state if unmounted before fetch resolves", async () => {
      let resolveFetch: (value: typeof mockAccountData) => void = () => {}
      const promise = new Promise(resolve => {
        resolveFetch = resolve
      })
      loadAccount.mockReturnValue(promise)

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

      loadAccount.mockReturnValueOnce(promise1).mockReturnValueOnce(promise2)

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
  })
})

describe("useBalance - watch", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    loadAccount.mockResolvedValue({ balances: [{ asset_type: "native", balance: "100" }] })
    mockGetHorizonServer.mockReturnValue({ loadAccount })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("watch: false (default) fetches once and never sets an interval", async () => {
    renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(1)

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(1)
  })

  test("watch: true re-fetches every 10 seconds by default", async () => {
    renderHook(() => useBalance({ address: TEST_ADDRESS, watch: true }), { wrapper })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(1)

    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(2)

    await act(async () => {
      jest.advanceTimersByTime(10_000)
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(3)
  })

  test("watch: true with interval: 5000 re-fetches every 5 seconds", async () => {
    renderHook(() => useBalance({ address: TEST_ADDRESS, watch: true, interval: 5_000 }), {
      wrapper,
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(1)

    await act(async () => {
      jest.advanceTimersByTime(5_000)
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(2)

    // Less than one interval — no extra fetch.
    await act(async () => {
      jest.advanceTimersByTime(4_999)
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(2)
  })

  test("clears the interval on unmount (no further fetches)", async () => {
    const clearSpy = jest.spyOn(global, "clearInterval")
    const { unmount } = renderHook(() => useBalance({ address: TEST_ADDRESS, watch: true }), {
      wrapper,
    })
    await flush()

    unmount()
    expect(clearSpy).toHaveBeenCalled()

    const callsBefore = loadAccount.mock.calls.length
    await act(async () => {
      jest.advanceTimersByTime(30_000)
    })
    await flush()
    expect(loadAccount).toHaveBeenCalledTimes(callsBefore)

    clearSpy.mockRestore()
  })
})
