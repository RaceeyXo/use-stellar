import { useState } from "react"
import { mockHorizonServer, TESTNET_ADDRESS_A, TESTNET_ADDRESS_B } from "@stellar/stellar-sdk"
import { onlineManager, useTransactionHistory } from "../index"
import { act, renderHookWithStellar, setAppState, setOnline, waitFor } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// Testnet addresses only (see core's SDK mock).
const ADDRESS = TESTNET_ADDRESS_A
const OTHER = TESTNET_ADDRESS_B

function makeTransaction(hash: string, overrides: Record<string, unknown> = {}) {
  return {
    hash,
    ledger: 1234,
    created_at: "2026-01-01T00:00:00Z",
    source_account: ADDRESS,
    fee_charged: "100",
    operation_count: 1,
    successful: true,
    memo: "hello",
    memo_type: "text",
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
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const ids = (transactions: { hash: string }[]) => transactions.map(t => t.hash)

describe("useTransactionHistory on React Native", () => {
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
    mockHorizonServer.transactions.mockReset().mockReturnValue(builder)
  })

  // The core onlineManager is a process-wide singleton the harness reset does
  // not touch; leave it online so one test cannot starve the next.
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  describe("initial load", () => {
    it("loads and normalizes the first page without DOM globals", async () => {
      assertNoDomGlobals()
      call.mockResolvedValue(
        pageOf([makeTransaction("1", { fee_charged: "250", ledger: "99" }), makeTransaction("2")])
      )

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(call).toHaveBeenCalledTimes(1)
      expect(result.current.error).toBeNull()
      expect(result.current.transactions).toHaveLength(2)
      expect(result.current.transactions[0]).toEqual({
        hash: "1",
        ledger: 99,
        createdAt: "2026-01-01T00:00:00Z",
        sourceAccount: ADDRESS,
        fee: "250",
        operationCount: 1,
        successful: true,
        memo: "hello",
        memoType: "text",
      })
      unmount()
    })

    it("over-fetches by one record to detect another page", async () => {
      call.mockResolvedValue(
        pageOf([makeTransaction("1"), makeTransaction("2"), makeTransaction("3")])
      )

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS, limit: 2 })
      )

      await waitFor(() => expect(result.current.loading).toBe(false))

      const builder = mockHorizonServer.transactions()
      expect(builder.limit).toHaveBeenCalledWith(3)
      expect(ids(result.current.transactions)).toEqual(["1", "2"])
      expect(result.current.hasNext).toBe(true)
      expect(result.current.hasPrev).toBe(false)
      unmount()
    })

    it("does not fetch without an address", async () => {
      const { result, unmount } = renderHookWithStellar(() => useTransactionHistory())

      await act(async () => {
        await Promise.resolve()
      })

      expect(call).not.toHaveBeenCalled()
      expect(result.current.transactions).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })
  })

  describe("app foreground", () => {
    it("keeps its data across a background/foreground cycle", async () => {
      call.mockResolvedValue(pageOf([makeTransaction("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      await act(async () => {
        await Promise.resolve()
      })

      expect(ids(result.current.transactions)).toEqual(["1"])
      expect(result.current.error).toBeNull()
      unmount()
    })

    // useTransactionHistory does not subscribe to the focus manager, so foregrounding
    // does not refetch by itself. The caller refetches explicitly (for
    // example from its own AppState handler), and that must work on native.
    it("refetches on demand once the app is back in the foreground", async () => {
      call
        .mockResolvedValueOnce(pageOf([makeTransaction("1")]))
        .mockResolvedValueOnce(pageOf([makeTransaction("2"), makeTransaction("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      expect(call).toHaveBeenCalledTimes(1)

      act(() => result.current.refetch())
      await waitFor(() => expect(ids(result.current.transactions)).toEqual(["2", "1"]))
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })
  })

  describe("offline", () => {
    it("does not request a new query while offline and fetches once on reconnect", async () => {
      call.mockResolvedValue(pageOf([makeTransaction("1")]))

      // A second, stable subscriber keeps the NetInfo listener attached while
      // the first one switches queries.
      let selectAddress: (address: string) => void = () => {}
      const { result, unmount } = renderHookWithStellar(() => {
        const [current, setCurrent] = useState(ADDRESS)
        selectAddress = setCurrent
        useTransactionHistory({ address: ADDRESS })
        return useTransactionHistory({ address: current })
      })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(call).toHaveBeenCalledTimes(1)

      // A query nobody has loaded yet, asked for while the device is offline.
      act(() => setOnline(false))
      call.mockResolvedValue(pageOf([makeTransaction("9", { source_account: OTHER })]))
      act(() => selectAddress(OTHER))
      await act(async () => {
        await Promise.resolve()
      })

      expect(call).toHaveBeenCalledTimes(1)
      expect(result.current.transactions).toEqual([])

      act(() => setOnline(true))
      await waitFor(() => expect(ids(result.current.transactions)).toEqual(["9"]))
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })

    it("keeps showing loaded data while offline without raising an error", async () => {
      call.mockResolvedValue(pageOf([makeTransaction("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => setOnline(false))
      act(() => result.current.refetch())
      await act(async () => {
        await Promise.resolve()
      })

      expect(call).toHaveBeenCalledTimes(1)
      expect(ids(result.current.transactions)).toEqual(["1"])
      expect(result.current.error).toBeNull()
      unmount()
    })
  })

  describe("error codes", () => {
    it("maps a 404 to ACCOUNT_NOT_FOUND", async () => {
      call.mockRejectedValue({ response: { status: 404 } })

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.transactions).toEqual([])
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("maps a plain network failure to NETWORK_ERROR", async () => {
      call.mockRejectedValue(new Error("Network Error"))

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      unmount()
    })

    it("maps a 429 to RATE_LIMITED once retries are exhausted", async () => {
      // The hook has no maxRetries option, so it backs off three times first.
      call.mockRejectedValue({ response: { status: 429 } })

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS })
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
      call.mockResolvedValue(
        pageOf([makeTransaction("1"), makeTransaction("2"), makeTransaction("3")], { next })
      )

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS, limit: 2 })
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
      const page2 = pageOf([makeTransaction("4"), makeTransaction("5")])
      const next = jest.fn().mockResolvedValue(page2)
      call.mockResolvedValue(
        pageOf([makeTransaction("1"), makeTransaction("2"), makeTransaction("3")], { next })
      )

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(next).toHaveBeenCalledTimes(1)
      expect(ids(result.current.transactions)).toEqual(["4", "5"])
      expect(result.current.hasNext).toBe(false)
      expect(result.current.hasPrev).toBe(true)
      unmount()
    })

    it("does nothing when there is no next page", async () => {
      call.mockResolvedValue(pageOf([makeTransaction("1")]))

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.fetchNext()
      })

      expect(ids(result.current.transactions)).toEqual(["1"])
      expect(result.current.hasNext).toBe(false)
      unmount()
    })

    it("shows each record once when fetchNext is called twice in quick succession", async () => {
      const gate = deferred<ReturnType<typeof pageOf>>()
      const next = jest.fn().mockReturnValue(gate.promise)
      call.mockResolvedValue(
        pageOf([makeTransaction("1"), makeTransaction("2"), makeTransaction("3")], { next })
      )

      const { result, unmount } = renderHookWithStellar(() =>
        useTransactionHistory({ address: ADDRESS, limit: 2 })
      )
      await waitFor(() => expect(result.current.loading).toBe(false))

      // onEndReached can fire twice before the first request settles.
      const fetchNext = result.current.fetchNext
      let both: Promise<unknown[]> = Promise.resolve([])
      act(() => {
        both = Promise.all([fetchNext(), fetchNext()])
      })
      await act(async () => {
        gate.resolve(pageOf([makeTransaction("4"), makeTransaction("5")]))
        await both
      })

      const shown = ids(result.current.transactions)
      expect(new Set(shown).size).toBe(shown.length)
      expect(shown).toEqual(["4", "5"])
      unmount()
    })

    // KNOWN BUG, deliberately not patched in this test-only change: fetchNext
    // reads `next` from the render closure and has no in-flight guard, so two
    // calls before the first settles each request the same page. The displayed
    // records stay correct (the test above), but Horizon is hit twice. This
    // `it.failing` goes red the day the hook is fixed — then change it to `it`.
    it.failing(
      "requests the next page only once when fetchNext is called twice in quick succession",
      async () => {
        const gate = deferred<ReturnType<typeof pageOf>>()
        const next = jest.fn().mockReturnValue(gate.promise)
        call.mockResolvedValue(
          pageOf([makeTransaction("1"), makeTransaction("2"), makeTransaction("3")], { next })
        )

        const { result, unmount } = renderHookWithStellar(() =>
          useTransactionHistory({ address: ADDRESS, limit: 2 })
        )
        await waitFor(() => expect(result.current.loading).toBe(false))

        const fetchNext = result.current.fetchNext
        let both: Promise<unknown[]> = Promise.resolve([])
        act(() => {
          both = Promise.all([fetchNext(), fetchNext()])
        })
        await act(async () => {
          gate.resolve(pageOf([makeTransaction("4"), makeTransaction("5")]))
          await both
        })

        expect(next).toHaveBeenCalledTimes(1)
        unmount()
      }
    )
  })
})
