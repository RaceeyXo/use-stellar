import { useState } from "react"
import { mockHorizonServer, TESTNET_ADDRESS_A, TESTNET_ADDRESS_B } from "@stellar/stellar-sdk"
import { onlineManager, usePaymentHistory } from "../index"
import { act, renderHookWithStellar, setAppState, setOnline, waitFor } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// Testnet addresses only (see core's SDK mock).
const ADDRESS = TESTNET_ADDRESS_A
const COUNTERPARTY = TESTNET_ADDRESS_B

function makePayment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "payment",
    transaction_hash: `tx_${id}`,
    created_at: "2026-01-01T00:00:00Z",
    from: COUNTERPARTY,
    to: ADDRESS,
    amount: "1.0000000",
    asset_type: "native",
    ...overrides,
  }
}

const incoming = (id: string) => makePayment(id)
const outgoing = (id: string) => makePayment(id, { from: ADDRESS, to: COUNTERPARTY })

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

const ids = (payments: { id: string }[]) => payments.map(p => p.id)

describe("usePaymentHistory on React Native", () => {
  // A fresh query builder per test: Horizon.Server is mocked to return the
  // shared mockHorizonServer, so nothing here reaches the network.
  let call: jest.Mock

  beforeEach(() => {
    call = jest.fn()
    const builder = {
      forAccount: jest.fn(),
      limit: jest.fn(),
      order: jest.fn(),
      cursor: jest.fn(),
      call,
    }
    builder.forAccount.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    builder.cursor.mockReturnValue(builder)
    mockHorizonServer.payments.mockReset().mockReturnValue(builder)
  })

  // The core onlineManager is a process-wide singleton the harness reset does
  // not touch; leave it online so one test cannot starve the next.
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  describe("initial load", () => {
    it("loads the first page without DOM globals", async () => {
      assertNoDomGlobals()
      call.mockResolvedValue(pageOf([incoming("1"), outgoing("2")]))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )

      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "2"]))
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.hasNext).toBe(false)
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("filters by direction", async () => {
      call.mockResolvedValue(pageOf([incoming("1"), outgoing("2"), incoming("3")]))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, direction: "incoming" })
      )

      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "3"]))
      unmount()
    })

    it("filters by issued asset", async () => {
      const issuer = TESTNET_ADDRESS_B
      call.mockResolvedValue(
        pageOf([
          makePayment("1"),
          makePayment("2", {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: issuer,
          }),
        ])
      )

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, asset: { code: "USDC", issuer } })
      )

      await waitFor(() => expect(ids(result.current.payments)).toEqual(["2"]))
      unmount()
    })

    it("does not fetch without an address", async () => {
      const { result, unmount } = renderHookWithStellar(() => usePaymentHistory())

      await act(async () => {
        await Promise.resolve()
      })

      expect(call).not.toHaveBeenCalled()
      expect(result.current.payments).toEqual([])
      unmount()
    })
  })

  describe("accumulation", () => {
    it("keeps paging until the filtered page is full", async () => {
      const next = jest.fn().mockResolvedValue(pageOf([incoming("4"), incoming("5")]))
      call.mockResolvedValue(pageOf([outgoing("1"), outgoing("2"), outgoing("3")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, limit: 2, direction: "incoming" })
      )

      await waitFor(() => expect(ids(result.current.payments)).toEqual(["4", "5"]))
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.current.accumulationBoundHit).toBe(false)
      unmount()
    })

    it("stops at maxAccumulationPages and reports it", async () => {
      const pageThree = pageOf([outgoing("7"), outgoing("8"), outgoing("9")])
      const pageTwo = pageOf([outgoing("4"), outgoing("5"), outgoing("6")], {
        next: jest.fn().mockResolvedValue(pageThree),
      })
      call.mockResolvedValue(
        pageOf([outgoing("1"), outgoing("2"), outgoing("3")], {
          next: jest.fn().mockResolvedValue(pageTwo),
        })
      )

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({
          address: ADDRESS,
          limit: 2,
          direction: "incoming",
          maxAccumulationPages: 2,
        })
      )

      await waitFor(() => expect(result.current.accumulationBoundHit).toBe(true))
      expect(result.current.payments).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })
  })

  describe("app foreground", () => {
    it("keeps its data across a background/foreground cycle", async () => {
      call.mockResolvedValue(pageOf([incoming("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1"]))

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      await act(async () => {
        await Promise.resolve()
      })

      expect(ids(result.current.payments)).toEqual(["1"])
      expect(result.current.error).toBeNull()
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    // usePaymentHistory does not subscribe to the focus manager, so
    // foregrounding does not refetch by itself. The caller refetches
    // explicitly (for example from its own AppState handler).
    it("refetches on demand once the app is back in the foreground", async () => {
      call
        .mockResolvedValueOnce(pageOf([incoming("1")]))
        .mockResolvedValueOnce(pageOf([incoming("2"), incoming("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1"]))

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => result.current.refetch())
      await waitFor(() => expect(call).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(ids(result.current.payments)).toContain("2"))
      unmount()
    })
  })

  describe("offline", () => {
    it("does not request a new query while offline and fetches once on reconnect", async () => {
      call.mockResolvedValue(pageOf([incoming("1")]))

      // A second, stable subscriber keeps the NetInfo listener attached while
      // the first one switches queries.
      let selectAddress: (address: string) => void = () => {}
      const { result, unmount } = renderHookWithStellar(() => {
        const [current, setCurrent] = useState(ADDRESS)
        selectAddress = setCurrent
        usePaymentHistory({ address: ADDRESS })
        return usePaymentHistory({ address: current })
      })
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1"]))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => setOnline(false))
      call.mockResolvedValue(pageOf([incoming("9")]))
      act(() => selectAddress(COUNTERPARTY))
      await act(async () => {
        await Promise.resolve()
      })

      expect(call).toHaveBeenCalledTimes(1)
      expect(result.current.payments).toEqual([])

      act(() => setOnline(true))
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["9"]))
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })

    it("keeps showing loaded data while offline without raising an error", async () => {
      call.mockResolvedValue(pageOf([incoming("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1"]))

      act(() => setOnline(false))
      act(() => result.current.refetch())
      await act(async () => {
        await Promise.resolve()
      })

      expect(call).toHaveBeenCalledTimes(1)
      expect(ids(result.current.payments)).toEqual(["1"])
      expect(result.current.error).toBeNull()
      unmount()
    })
  })

  describe("error codes", () => {
    it("maps a 404 to ACCOUNT_NOT_FOUND", async () => {
      call.mockRejectedValue({ response: { status: 404 } })

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.payments).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("maps a plain network failure to NETWORK_ERROR", async () => {
      call.mockRejectedValue(new Error("Network Error"))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      unmount()
    })

    it("maps a 429 to RATE_LIMITED once retries are exhausted", async () => {
      // The hook has no maxRetries option, so it backs off three times first.
      call.mockRejectedValue({ response: { status: 429 } })

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS })
      )

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
      call.mockResolvedValue(pageOf([incoming("1"), incoming("2"), incoming("3")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "2"]))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      unmount()
    })

    // KNOWN BUG, deliberately not patched in this test-only change: fetchNext
    // sets `isAccumulating` before the request, and the accumulation effect
    // returns early on error without clearing it, so `loading` stays true after
    // a failed page and a FlatList footer spinner never goes away. Change to
    // `it` once the hook is fixed.
    it.failing("clears loading after a failed page navigation", async () => {
      const next = jest.fn().mockRejectedValue({ response: { status: 404 } })
      call.mockResolvedValue(pageOf([incoming("1"), incoming("2"), incoming("3")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "2"]))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(result.current.loading).toBe(false)
      unmount()
    })
  })

  describe("pagination (FlatList onEndReached)", () => {
    it("moves to the next page", async () => {
      const next = jest.fn().mockResolvedValue(pageOf([incoming("4"), incoming("5")]))
      call.mockResolvedValue(pageOf([incoming("1"), incoming("2"), incoming("3")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "2"]))
      expect(result.current.hasNext).toBe(true)

      await act(async () => {
        await result.current.fetchNext()
      })

      await waitFor(() => expect(ids(result.current.payments)).toEqual(["4", "5"]))
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.current.hasNext).toBe(false)
      expect(result.current.hasPrev).toBe(true)
      unmount()
    })

    it("does nothing when there is no next page", async () => {
      call.mockResolvedValue(pageOf([incoming("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1"]))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(ids(result.current.payments)).toEqual(["1"])
      expect(result.current.hasNext).toBe(false)
      unmount()
    })

    it("shows each record once when fetchNext is called twice in quick succession", async () => {
      const gate = deferred<ReturnType<typeof pageOf>>()
      const next = jest.fn().mockReturnValue(gate.promise)
      call.mockResolvedValue(pageOf([incoming("1"), incoming("2"), incoming("3")], { next }))

      const { result, unmount } = renderHookWithStellar(() =>
        usePaymentHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "2"]))

      // onEndReached can fire twice before the first request settles.
      const fetchNext = result.current.fetchNext
      let both: Promise<unknown[]> = Promise.resolve([])
      act(() => {
        both = Promise.all([fetchNext(), fetchNext()])
      })
      await act(async () => {
        gate.resolve(pageOf([incoming("4"), incoming("5")]))
        await both
      })

      await waitFor(() => expect(ids(result.current.payments)).toEqual(["4", "5"]))
      const shown = ids(result.current.payments)
      expect(new Set(shown).size).toBe(shown.length)
      unmount()
    })

    // KNOWN BUG, deliberately not patched in this test-only change: the
    // `isAccumulating` guard in fetchNext is read from the render closure, so
    // two calls before the next render both pass it and both request the same
    // page. The displayed records stay correct (the test above), but Horizon is
    // hit twice. This `it.failing` goes red the day the hook is fixed — then
    // change it to `it`.
    it.failing(
      "requests the next page only once when fetchNext is called twice in quick succession",
      async () => {
        const gate = deferred<ReturnType<typeof pageOf>>()
        const next = jest.fn().mockReturnValue(gate.promise)
        call.mockResolvedValue(pageOf([incoming("1"), incoming("2"), incoming("3")], { next }))

        const { result, unmount } = renderHookWithStellar(() =>
          usePaymentHistory({ address: ADDRESS, limit: 2 })
        )
        await waitFor(() => expect(ids(result.current.payments)).toEqual(["1", "2"]))

        const fetchNext = result.current.fetchNext
        let both: Promise<unknown[]> = Promise.resolve([])
        act(() => {
          both = Promise.all([fetchNext(), fetchNext()])
        })
        await act(async () => {
          gate.resolve(pageOf([incoming("4"), incoming("5")]))
          await both
        })

        expect(next).toHaveBeenCalledTimes(1)
        unmount()
      }
    )
  })
})
