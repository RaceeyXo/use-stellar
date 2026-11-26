import { mockHorizonServer, TESTNET_ADDRESS_B } from "@stellar/stellar-sdk"
import { useOrderbook } from "../index"
import {
  act,
  getAppState,
  renderHookWithStellar,
  setAppState,
  setOnline,
  waitFor,
} from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// Testnet-only: the issuer is a throwaway testnet account.
const USDC = { code: "USDC", issuer: TESTNET_ADDRESS_B }

// Bid 1/2, ask 3/4 -> spread 1/4, mid price 5/8.
const BOOK = {
  bids: [{ price: "0.5000000", amount: "100", price_r: { n: 1, d: 2 } }],
  asks: [{ price: "0.7500000", amount: "80", price_r: { n: 3, d: 4 } }],
}

// Bid 1/2, ask 4/5 -> spread 3/10, mid price 13/20.
const MOVED_BOOK = {
  bids: [{ price: "0.5000000", amount: "100", price_r: { n: 1, d: 2 } }],
  asks: [{ price: "0.8000000", amount: "60", price_r: { n: 4, d: 5 } }],
}

describe("useOrderbook on React Native", () => {
  let call: jest.Mock
  let limit: jest.Mock

  beforeEach(() => {
    mockHorizonServer.reset()
    call = jest.fn().mockResolvedValue(BOOK)
    limit = jest.fn(() => ({ call }))
    mockHorizonServer.orderbook.mockReturnValue({ limit })
  })

  describe("initial load", () => {
    it("loads the book and derives an exact spread and mid price without any DOM global", async () => {
      assertNoDomGlobals()
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.bids).toHaveLength(1)
      })

      expect(result.current.asks).toEqual([
        { price: "0.7500000", amount: "80", priceR: { n: 3, d: 4 } },
      ])
      expect(result.current.spread).toBe("0.25")
      expect(result.current.midPrice).toBe("0.625")
      expect(result.current.lastUpdated).toBeInstanceOf(Date)
      expect(result.current.error).toBeNull()
      expect(limit).toHaveBeenCalledWith(20)
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("makes no request when disabled", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC, enabled: false })
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.bids).toEqual([])
      expect(mockHorizonServer.orderbook).not.toHaveBeenCalled()
      unmount()
    })

    it("polls on the interval while watching", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC, watch: true, interval: 5000 })
      )
      await waitFor(() => expect(result.current.bids).toHaveLength(1))
      expect(call).toHaveBeenCalledTimes(1)

      call.mockResolvedValue(MOVED_BOOK)
      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => expect(result.current.midPrice).toBe("0.65"))
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })
  })

  describe("foreground", () => {
    it("keeps its book across a background/foreground round trip without extra requests", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )
      await waitFor(() => expect(result.current.bids).toHaveLength(1))

      act(() => {
        setAppState("background")
      })
      expect(getAppState()).toBe("background")
      act(() => {
        jest.advanceTimersByTime(60_000)
      })
      act(() => {
        setAppState("active")
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.spread).toBe("0.25")
      expect(result.current.error).toBeNull()
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("shows the moved book when refetched after returning to the foreground", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )
      await waitFor(() => expect(result.current.bids).toHaveLength(1))

      act(() => {
        setAppState("background")
      })
      call.mockResolvedValue(MOVED_BOOK)
      act(() => {
        setAppState("active")
      })
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.spread).toBe("0.3")
      expect(result.current.midPrice).toBe("0.65")
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })
  })

  describe("offline", () => {
    it("surfaces a NETWORK_ERROR, keeps the last book, and recovers once back online", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )
      await waitFor(() => expect(result.current.bids).toHaveLength(1))

      act(() => {
        setOnline(false)
      })
      call.mockRejectedValue(new Error("Network Error"))
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.spread).toBe("0.25")
      expect(result.current.loading).toBe(false)

      act(() => {
        setOnline(true)
      })
      call.mockResolvedValue(MOVED_BOOK)
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.midPrice).toBe("0.65")
      unmount()
    })
  })

  describe("error codes", () => {
    it("maps an unknown market (404) to ACCOUNT_NOT_FOUND", async () => {
      call.mockRejectedValue({ response: { status: 404, data: {} } })
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())

      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.bids).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("maps a rate limit (429) to RATE_LIMITED", async () => {
      call.mockRejectedValue({ response: { status: 429, data: {} } })
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )

      await waitFor(() => expect(result.current.error?.code).toBe("RATE_LIMITED"))
      unmount()
    })

    it("maps a gateway failure (503) to NETWORK_ERROR", async () => {
      call.mockRejectedValue({ response: { status: 503, data: {} } })
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: USDC })
      )

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      unmount()
    })

    it("rejects an unsupported asset with VALIDATION_ERROR before any request", async () => {
      // Hoisted so the asset keeps its identity across renders: the hook keys
      // an unsupported asset by reference, so an inline object would refetch
      // on every render.
      const unsupported = { liquidityPoolId: "abc" } as unknown as typeof USDC
      const { result, unmount } = renderHookWithStellar(() =>
        useOrderbook({ selling: "XLM", buying: unsupported })
      )

      await waitFor(() => expect(result.current.error?.code).toBe("VALIDATION_ERROR"))
      expect(mockHorizonServer.orderbook).not.toHaveBeenCalled()
      unmount()
    })
  })
})
