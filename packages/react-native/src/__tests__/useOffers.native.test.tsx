import {
  createCollectionBuilder,
  mockHorizonServer,
  TESTNET_ADDRESS_A,
  TESTNET_ADDRESS_B,
} from "@stellar/stellar-sdk"
import { useOffers } from "../index"
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
function offerRecord(id: number, amount = "10") {
  return {
    id,
    seller: TESTNET_ADDRESS_A,
    amount,
    price: "2.0000000",
    price_r: { n: 2, d: 1 },
    selling: { asset_type: "native" },
    buying: {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: TESTNET_ADDRESS_B,
    },
  }
}

describe("useOffers on React Native", () => {
  let builder: ReturnType<typeof createCollectionBuilder>
  let next: jest.Mock
  let prev: jest.Mock

  beforeEach(() => {
    mockHorizonServer.reset()
    builder = createCollectionBuilder()
    next = jest.fn()
    prev = jest.fn()
    builder.call.mockResolvedValue({ records: [offerRecord(100)], next, prev })
    mockHorizonServer.offers.mockReturnValue(builder)
  })

  describe("initial load", () => {
    it("normalizes the account's open offers without any DOM global", async () => {
      assertNoDomGlobals()
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.offers).toHaveLength(1)
      })

      expect(result.current.offers[0]).toEqual({
        id: "100",
        seller: TESTNET_ADDRESS_A,
        selling: "XLM",
        buying: { code: "USDC", issuer: TESTNET_ADDRESS_B },
        amount: "10",
        priceR: { n: 2, d: 1 },
        price: "2.0000000",
      })
      expect(result.current.error).toBeNull()
      expect(result.current.hasNext).toBe(false)
      expect(result.current.hasPrev).toBe(false)
      expect(builder.forAccount).toHaveBeenCalledWith(TESTNET_ADDRESS_A)
      expect(mockHorizonServer.offers).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("makes no request without an address or connected wallet", async () => {
      const { result, unmount } = renderHookWithStellar(() => useOffers())

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.offers).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(mockHorizonServer.offers).not.toHaveBeenCalled()
      unmount()
    })

    it("pages forward with fetchNext", async () => {
      const limit = 1
      builder.call.mockResolvedValue({ records: [offerRecord(100)], next, prev })
      next.mockResolvedValue({ records: [offerRecord(101, "5")], next, prev })
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A, limit })
      )

      await waitFor(() => expect(result.current.hasNext).toBe(true))
      await act(async () => {
        await result.current.fetchNext()
      })

      expect(result.current.offers.map(offer => offer.id)).toEqual(["101"])
      expect(result.current.hasPrev).toBe(true)
      expect(next).toHaveBeenCalledTimes(1)
      unmount()
    })
  })

  describe("foreground", () => {
    it("keeps its offers across a background/foreground round trip without extra requests", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )
      await waitFor(() => expect(result.current.offers).toHaveLength(1))
      const requests = builder.call.mock.calls.length

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

      expect(result.current.offers.map(offer => offer.id)).toEqual(["100"])
      expect(result.current.error).toBeNull()
      expect(builder.call).toHaveBeenCalledTimes(requests)
      unmount()
    })

    it("refetches fresh offers when asked after returning to the foreground", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )
      await waitFor(() => expect(result.current.offers).toHaveLength(1))

      act(() => {
        setAppState("background")
      })
      builder.call.mockResolvedValue({
        records: [offerRecord(100), offerRecord(102, "3")],
        next,
        prev,
      })
      act(() => {
        setAppState("active")
      })
      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => expect(result.current.offers).toHaveLength(2))
      expect(result.current.offers.map(offer => offer.id)).toEqual(["100", "102"])
      unmount()
    })
  })

  describe("offline", () => {
    it("starts no request while offline, keeps the last offers, and refetches on reconnect", async () => {
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )
      await waitFor(() => expect(result.current.offers).toHaveLength(1))
      const requests = builder.call.mock.calls.length

      act(() => {
        setOnline(false)
      })
      await act(async () => {
        await result.current.refetch()
      })

      expect(builder.call).toHaveBeenCalledTimes(requests)
      expect(result.current.error).toBeNull()
      expect(result.current.offers).toHaveLength(1)

      // Past the 30s stale time, so reconnecting has something to refresh.
      act(() => {
        jest.advanceTimersByTime(31_000)
      })
      builder.call.mockResolvedValue({ records: [offerRecord(100), offerRecord(103)], next, prev })
      await act(async () => {
        setOnline(true)
        await Promise.resolve()
      })

      await waitFor(() => expect(result.current.offers).toHaveLength(2))
      expect(builder.call).toHaveBeenCalledTimes(requests + 1)
      unmount()
    })
  })

  describe("error codes", () => {
    it("maps a missing account (404) to ACCOUNT_NOT_FOUND with no offers", async () => {
      builder.call.mockRejectedValue({ response: { status: 404, data: {} } })
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())

      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.offers).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("maps a transport failure to NETWORK_ERROR", async () => {
      builder.call.mockRejectedValue(new Error("Network Error"))
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      unmount()
    })

    it("maps a gateway failure (503) to NETWORK_ERROR", async () => {
      builder.call.mockRejectedValue({ response: { status: 503, data: {} } })
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      unmount()
    })

    it("surfaces a failed page request as an error and clears the page", async () => {
      builder.call.mockResolvedValue({ records: [offerRecord(100)], next, prev })
      next.mockRejectedValue({ response: { status: 404, data: {} } })
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A, limit: 1 })
      )

      await waitFor(() => expect(result.current.hasNext).toBe(true))
      await act(async () => {
        await result.current.fetchNext()
      })

      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.offers).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("recovers on refetch after an error", async () => {
      builder.call.mockRejectedValueOnce(new Error("Network Error"))
      const { result, unmount } = renderHookWithStellar(() =>
        useOffers({ address: TESTNET_ADDRESS_A })
      )
      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))

      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => expect(result.current.offers).toHaveLength(1))
      expect(result.current.error).toBeNull()
      unmount()
    })
  })
})
