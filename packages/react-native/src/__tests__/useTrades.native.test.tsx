import { useState } from "react"
import { mockHorizonServer, TESTNET_ADDRESS_A, TESTNET_ADDRESS_B } from "@stellar/stellar-sdk"
import { onlineManager, useTrades } from "../index"
import { act, renderHookWithStellar, setAppState, setOnline, waitFor } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// Testnet addresses only (see core's SDK mock).
const ACCOUNT = TESTNET_ADDRESS_A
const OTHER = TESTNET_ADDRESS_B
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

/** Core's SDK mock has no trades() endpoint yet, so the test supplies one. */
const horizon = mockHorizonServer as typeof mockHorizonServer & { trades: jest.Mock }

/** A raw Horizon trade: ACCOUNT sells XLM for USDC to OTHER. */
function makeTrade(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    paging_token: `paging-${id}`,
    ledger_close_time: "2026-01-01T00:00:00Z",
    trade_type: "orderbook",
    base_account: ACCOUNT,
    base_amount: "100.0000000",
    base_asset_type: "native",
    counter_account: OTHER,
    counter_amount: "25.0000000",
    counter_asset_type: "credit_alphanum4",
    counter_asset_code: "USDC",
    counter_asset_issuer: USDC_ISSUER,
    base_is_seller: true,
    price: { n: "25", d: "100" },
    ...overrides,
  }
}

/** A Horizon collection page whose next()/prev() are jest mocks. */
function pageOf(records: unknown[], links: { next?: jest.Mock; prev?: jest.Mock } = {}) {
  const empty = { records: [] as unknown[], next: jest.fn(), prev: jest.fn() }
  return {
    records,
    next: links.next ?? jest.fn().mockResolvedValue(empty),
    prev: links.prev ?? jest.fn().mockResolvedValue(empty),
  }
}

/** A promise the test resolves by hand, to hold a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

const ids = (trades: { id: string }[]) => trades.map(t => t.id)

describe("useTrades on React Native", () => {
  // A fresh query builder per test: Horizon.Server is mocked to return the
  // shared mockHorizonServer, so nothing here reaches the network.
  let call: jest.Mock
  let builder: Record<"forAccount" | "forAssetPair" | "limit" | "order", jest.Mock>

  beforeEach(() => {
    call = jest.fn()
    builder = {
      forAccount: jest.fn(),
      forAssetPair: jest.fn(),
      limit: jest.fn(),
      order: jest.fn(),
    }
    const chain = { ...builder, call }
    for (const method of Object.values(builder)) method.mockReturnValue(chain)
    horizon.trades = jest.fn().mockReturnValue(chain)
  })

  // The core onlineManager is a process-wide singleton the harness reset does
  // not touch; leave it online so one test cannot starve the next.
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  describe("initial load", () => {
    it("loads and normalizes the first page without DOM globals", async () => {
      assertNoDomGlobals()
      call.mockResolvedValue(pageOf([makeTrade("1"), makeTrade("2")]))

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(call).toHaveBeenCalledTimes(1)
      expect(builder.forAccount).toHaveBeenCalledWith(ACCOUNT)
      expect(result.current.error).toBeNull()
      expect(ids(result.current.trades)).toEqual(["1", "2"])
      expect(result.current.trades[0]).toMatchObject({
        id: "1",
        tradeType: "orderbook",
        baseAsset: "XLM",
        counterAsset: { code: "USDC", issuer: USDC_ISSUER },
        baseAmount: "100.0000000",
        counterAmount: "25.0000000",
        price: "0.25",
        side: "sell",
      })
      unmount()
    })

    it("queries an asset pair and orients every trade to the requested base", async () => {
      // Horizon returned this one with the pair flipped: USDC as base.
      call.mockResolvedValue(
        pageOf([
          makeTrade("1", {
            base_asset_type: "credit_alphanum4",
            base_asset_code: "USDC",
            base_asset_issuer: USDC_ISSUER,
            base_amount: "25.0000000",
            counter_asset_type: "native",
            counter_asset_code: undefined,
            counter_asset_issuer: undefined,
            counter_amount: "100.0000000",
            price: { n: "100", d: "25" },
          }),
        ])
      )

      const { result, unmount } = renderHookWithStellar(() =>
        useTrades({
          baseAsset: "XLM",
          counterAsset: { code: "USDC", issuer: USDC_ISSUER },
        })
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(builder.forAssetPair).toHaveBeenCalledTimes(1)
      expect(result.current.trades[0]).toMatchObject({
        baseAsset: "XLM",
        counterAsset: { code: "USDC", issuer: USDC_ISSUER },
        baseAmount: "100.0000000",
        counterAmount: "25.0000000",
      })
      unmount()
    })

    it("does not fetch without an address or base asset", async () => {
      const { result, unmount } = renderHookWithStellar(() => useTrades())

      await act(async () => {
        await Promise.resolve()
      })

      expect(call).not.toHaveBeenCalled()
      expect(result.current.trades).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })
  })

  describe("app foreground", () => {
    it("keeps its data across a background/foreground cycle", async () => {
      call.mockResolvedValue(pageOf([makeTrade("1")]))

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      await act(async () => {
        await Promise.resolve()
      })

      expect(ids(result.current.trades)).toEqual(["1"])
      expect(result.current.error).toBeNull()
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    // useTrades does not subscribe to the focus manager, so foregrounding does
    // not refetch by itself. The caller refetches explicitly (for example from
    // its own AppState handler), and that must work on native.
    it("refetches on demand once the app is back in the foreground", async () => {
      call
        .mockResolvedValueOnce(pageOf([makeTrade("1")]))
        .mockResolvedValueOnce(pageOf([makeTrade("2"), makeTrade("1")]))

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => result.current.refetch())
      await waitFor(() => expect(ids(result.current.trades)).toEqual(["2", "1"]))
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })
  })

  describe("offline", () => {
    it("does not request a new query while offline and fetches once on reconnect", async () => {
      call.mockResolvedValue(pageOf([makeTrade("1")]))

      // A second, stable subscriber keeps the NetInfo listener attached while
      // the first one switches queries.
      let selectAddress: (address: string) => void = () => {}
      const { result, unmount } = renderHookWithStellar(() => {
        const [current, setCurrent] = useState(ACCOUNT)
        selectAddress = setCurrent
        useTrades({ address: ACCOUNT })
        return useTrades({ address: current })
      })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => setOnline(false))
      call.mockResolvedValue(pageOf([makeTrade("9")]))
      act(() => selectAddress(OTHER))
      await act(async () => {
        await Promise.resolve()
      })

      expect(call).toHaveBeenCalledTimes(1)
      expect(result.current.trades).toEqual([])

      act(() => setOnline(true))
      await waitFor(() => expect(ids(result.current.trades)).toEqual(["9"]))
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })

    it("keeps showing loaded data while offline without raising an error", async () => {
      call.mockResolvedValue(pageOf([makeTrade("1")]))

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => setOnline(false))
      act(() => result.current.refetch())
      await act(async () => {
        await Promise.resolve()
      })

      expect(call).toHaveBeenCalledTimes(1)
      expect(ids(result.current.trades)).toEqual(["1"])
      expect(result.current.error).toBeNull()
      unmount()
    })
  })

  describe("error codes", () => {
    it("maps a 404 to ACCOUNT_NOT_FOUND", async () => {
      call.mockRejectedValue({ response: { status: 404 } })

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))

      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.trades).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("maps a plain network failure to NETWORK_ERROR", async () => {
      call.mockRejectedValue(new Error("Network Error"))

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))

      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      unmount()
    })

    it("maps a 429 to RATE_LIMITED once retries are exhausted", async () => {
      // The hook has no maxRetries option, so it backs off three times first.
      call.mockRejectedValue({ response: { status: 429 } })

      const { result, unmount } = renderHookWithStellar(() => useTrades({ address: ACCOUNT }))

      await act(async () => {
        await jest.advanceTimersByTimeAsync(120_000)
      })
      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("RATE_LIMITED")
      expect(call).toHaveBeenCalledTimes(4)
      unmount()
    })

    it("surfaces a failed page navigation as an error", async () => {
      const next = jest.fn().mockRejectedValue({ response: { status: 404 } })
      call.mockResolvedValue(pageOf([makeTrade("1"), makeTrade("2")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        useTrades({ address: ACCOUNT, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.loading).toBe(false)
      unmount()
    })
  })

  describe("pagination (FlatList onEndReached)", () => {
    it("moves to the next page", async () => {
      const next = jest.fn().mockResolvedValue(pageOf([makeTrade("3")]))
      call.mockResolvedValue(pageOf([makeTrade("1"), makeTrade("2")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        useTrades({ address: ACCOUNT, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.hasNext).toBe(true)

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(next).toHaveBeenCalledTimes(1)
      expect(ids(result.current.trades)).toEqual(["3"])
      expect(result.current.hasNext).toBe(false)
      expect(result.current.hasPrev).toBe(true)
      unmount()
    })

    it("does nothing when there is no next page", async () => {
      call.mockResolvedValue(pageOf([]))

      const { result, unmount } = renderHookWithStellar(() =>
        useTrades({ address: ACCOUNT, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(result.current.trades).toEqual([])
      expect(result.current.hasNext).toBe(false)
      unmount()
    })

    it("shows each record once when fetchNext is called twice in quick succession", async () => {
      const gate = deferred<ReturnType<typeof pageOf>>()
      const next = jest.fn().mockReturnValue(gate.promise)
      call.mockResolvedValue(pageOf([makeTrade("1"), makeTrade("2")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        useTrades({ address: ACCOUNT, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      // onEndReached can fire twice before the first request settles.
      const fetchNext = result.current.fetchNext
      let both: Promise<unknown[]> = Promise.resolve([])
      act(() => {
        both = Promise.all([fetchNext(), fetchNext()])
      })
      await act(async () => {
        gate.resolve(pageOf([makeTrade("3"), makeTrade("4")]))
        await both
      })

      const shown = ids(result.current.trades)
      expect(new Set(shown).size).toBe(shown.length)
      expect(shown).toEqual(["3", "4"])
      unmount()
    })

    // KNOWN BUG, deliberately not patched in this test-only change: fetchNext
    // has no in-flight guard, so two calls before the first settles each
    // request the same page. The displayed records stay correct (the test
    // above), but Horizon is hit twice. This `it.failing` goes red the day the
    // hook is fixed — then change it to `it`.
    it.failing(
      "requests the next page only once when fetchNext is called twice in quick succession",
      async () => {
        const gate = deferred<ReturnType<typeof pageOf>>()
        const next = jest.fn().mockReturnValue(gate.promise)
        call.mockResolvedValue(pageOf([makeTrade("1"), makeTrade("2")], { next }))

        const { result, unmount } = renderHookWithStellar(() =>
          useTrades({ address: ACCOUNT, limit: 2 })
        )
        await waitFor(() => expect(result.current.loading).toBe(false))

        const fetchNext = result.current.fetchNext
        let both: Promise<unknown[]> = Promise.resolve([])
        act(() => {
          both = Promise.all([fetchNext(), fetchNext()])
        })
        await act(async () => {
          gate.resolve(pageOf([makeTrade("3"), makeTrade("4")]))
          await both
        })

        expect(next).toHaveBeenCalledTimes(1)
        unmount()
      }
    )
  })
})
