import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { usePayments } from "./usePayments"

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
}))

import { getHorizonServer } from "../utils"

const mockGetHorizonServer = getHorizonServer as jest.Mock

const mockCall = jest.fn()
const mockNext = jest.fn()
const mockPrev = jest.fn()

const mockQuery = {
  forAccount: jest.fn(),
  limit: jest.fn(),
  order: jest.fn(),
  cursor: jest.fn(),
  call: mockCall,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

describe("usePayments", () => {
  const address = "G_TARGET"

  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.forAccount.mockReturnValue(mockQuery)
    mockQuery.limit.mockReturnValue(mockQuery)
    mockQuery.order.mockReturnValue(mockQuery)
    mockQuery.cursor.mockReturnValue(mockQuery)
    mockGetHorizonServer.mockReturnValue({ payments: () => mockQuery })
  })

  it("handles empty state and returns empty array", async () => {
    mockCall.mockResolvedValueOnce({ records: [] })

    const { result } = renderHook(() => usePayments({ address }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.payments).toEqual([])
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it("normalizes native XLM payment operations", async () => {
    const rawRecords = [
      {
        id: "100",
        type: "payment",
        transaction_hash: "tx_1",
        created_at: "2026-06-25T18:00:00Z",
        from: "G_SENDER",
        to: address,
        amount: "10.5",
        asset_type: "native",
      },
    ]

    mockCall.mockResolvedValueOnce({ records: rawRecords })

    const { result } = renderHook(() => usePayments({ address }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0]).toEqual({
      id: "100",
      txHash: "tx_1",
      type: "payment",
      from: "G_SENDER",
      to: address,
      amount: "10.5",
      asset: "XLM",
      direction: "incoming",
      createdAt: "2026-06-25T18:00:00Z",
    })
  })

  it("normalizes issued asset payments correctly", async () => {
    const rawRecords = [
      {
        id: "101",
        type: "payment",
        transaction_hash: "tx_2",
        created_at: "2026-06-25T18:01:00Z",
        from: address,
        to: "G_RECEIVER",
        amount: "500.0",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "G_ISSUER",
      },
    ]

    mockCall.mockResolvedValueOnce({ records: rawRecords })

    const { result } = renderHook(() => usePayments({ address }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0]).toEqual({
      id: "101",
      txHash: "tx_2",
      type: "payment",
      from: address,
      to: "G_RECEIVER",
      amount: "500.0",
      asset: { code: "USDC", issuer: "G_ISSUER" },
      direction: "outgoing",
      createdAt: "2026-06-25T18:01:00Z",
    })
  })

  it("handles create_account and account_merge operations as native payments", async () => {
    const rawRecords = [
      {
        id: "102",
        type: "create_account",
        transaction_hash: "tx_3",
        created_at: "2026-06-25T18:02:00Z",
        funder: "G_SENDER",
        account: address,
        starting_balance: "1.5",
      },
      {
        id: "103",
        type: "account_merge",
        transaction_hash: "tx_4",
        created_at: "2026-06-25T18:03:00Z",
        account: address,
        into: "G_RECEIVER",
        amount: "2.5",
      },
    ]

    mockCall.mockResolvedValueOnce({ records: rawRecords })

    const { result } = renderHook(() => usePayments({ address }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(2)
    expect(result.current.payments[0].type).toBe("create_account")
    expect(result.current.payments[0].direction).toBe("incoming")
    expect(result.current.payments[0].asset).toBe("XLM")

    expect(result.current.payments[1].type).toBe("account_merge")
    expect(result.current.payments[1].direction).toBe("outgoing")
    expect(result.current.payments[1].asset).toBe("XLM")
  })

  it("handles pagination via fetchNext and fetchPrev", async () => {
    const page1 = {
      records: [
        {
          id: "200",
          type: "payment",
          transaction_hash: "tx_p1",
          created_at: "2026-06-25T18:10:00Z",
          from: "G_SENDER",
          to: address,
          amount: "1.0",
          asset_type: "native",
        },
      ],
      next: mockNext,
      prev: mockPrev,
    }

    const page2 = {
      records: [
        {
          id: "201",
          type: "payment",
          transaction_hash: "tx_p2",
          created_at: "2026-06-25T18:11:00Z",
          from: "G_SENDER",
          to: address,
          amount: "2.0",
          asset_type: "native",
        },
      ],
      next: mockNext,
      prev: mockPrev,
    }

    mockCall.mockResolvedValueOnce(page1)
    mockNext.mockResolvedValueOnce(page2)

    const { result } = renderHook(() => usePayments({ address, limit: 1 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments[0].id).toBe("200")
    expect(result.current.hasNext).toBe(true)

    // Fetch next page
    await act(async () => {
      await result.current.fetchNext()
    })

    expect(result.current.payments[0].id).toBe("201")
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it("handles errors gracefully", async () => {
    mockCall.mockRejectedValueOnce(new Error("Network Error"))

    const { result } = renderHook(() => usePayments({ address }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.payments).toEqual([])
  })

  describe("stale-while-revalidate", () => {
    const paymentRecord = {
      id: "100",
      type: "payment",
      transaction_hash: "tx_1",
      created_at: "2026-06-25T18:00:00Z",
      from: "G_SENDER",
      to: address,
      amount: "10.5",
      asset_type: "native",
    }

    it("keeps payments and lastUpdated-equivalent state after a failing poll, and flags isStale", async () => {
      mockCall.mockResolvedValueOnce({ records: [paymentRecord] })

      const { result } = renderHook(() => usePayments({ address }), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.payments).toHaveLength(1)
      expect(result.current.isStale).toBe(false)

      mockCall.mockRejectedValueOnce(new Error("Network Error"))

      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.payments).toHaveLength(1)
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.isStale).toBe(true)
    })

    it("clears payments immediately when the address changes, before the new fetch resolves", async () => {
      let resolveSecond: (value: { records: unknown[] }) => void = () => {}
      const promise2 = new Promise<{ records: unknown[] }>(resolve => {
        resolveSecond = resolve
      })
      mockCall.mockResolvedValueOnce({ records: [paymentRecord] }).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ addr }) => usePayments({ address: addr }), {
        initialProps: { addr: address as string | null },
        wrapper,
      })

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.payments).toHaveLength(1)

      rerender({ addr: "G_OTHER_TARGET" })

      // Cleared synchronously — before the new fetch has resolved.
      expect(result.current.payments).toEqual([])

      await act(async () => {
        resolveSecond({ records: [] })
      })

      expect(result.current.loading).toBe(false)
    })

    it("clears error and refreshes data on a subsequent successful refetch", async () => {
      mockCall.mockRejectedValueOnce(new Error("Network Error"))
      mockCall.mockResolvedValueOnce({ records: [paymentRecord] })

      const { result } = renderHook(() => usePayments({ address }), { wrapper })

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      expect(result.current.payments).toEqual([])

      act(() => {
        result.current.refetch()
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBeNull()
      expect(result.current.payments).toHaveLength(1)
      expect(result.current.isStale).toBe(false)
    })
  })

  describe("race and unmount guards", () => {
    it("does not update state if unmounted before the fetch resolves", async () => {
      let resolveFetch: (value: { records: unknown[] }) => void = () => {}
      const promise = new Promise<{ records: unknown[] }>(resolve => {
        resolveFetch = resolve
      })
      mockCall.mockReturnValue(promise)

      const { result, unmount } = renderHook(() => usePayments({ address }), { wrapper })

      expect(result.current.loading).toBe(true)

      unmount()

      await act(async () => {
        resolveFetch({ records: [] })
      })
    })

    it("does not let an older response overwrite a newer one when the address changes mid-flight", async () => {
      let resolveFirst: (value: { records: unknown[] }) => void = () => {}
      let resolveSecond: (value: { records: unknown[] }) => void = () => {}

      const promise1 = new Promise<{ records: unknown[] }>(resolve => {
        resolveFirst = resolve
      })
      const promise2 = new Promise<{ records: unknown[] }>(resolve => {
        resolveSecond = resolve
      })

      mockCall.mockReturnValueOnce(promise1).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ addr }) => usePayments({ address: addr }), {
        initialProps: { addr: address as string | null },
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      const NEW_ADDRESS = "G_OTHER_TARGET"
      rerender({ addr: NEW_ADDRESS })

      const newRecord = {
        id: "300",
        type: "payment",
        transaction_hash: "tx_new",
        created_at: "2026-06-25T19:00:00Z",
        from: "G_SENDER",
        to: NEW_ADDRESS,
        amount: "5.0",
        asset_type: "native",
      }

      await act(async () => {
        resolveSecond({ records: [newRecord] })
      })

      expect(result.current.payments[0]?.id).toBe("300")
      expect(result.current.loading).toBe(false)

      await act(async () => {
        resolveFirst({ records: [] })
      })

      expect(result.current.payments[0]?.id).toBe("300")
    })

    it("a superseded fetchNext response cannot install its pagination callbacks over a newer page's", async () => {
      const page1Record = {
        id: "200",
        type: "payment",
        transaction_hash: "tx_p1",
        created_at: "2026-06-25T18:10:00Z",
        from: "G_SENDER",
        to: address,
        amount: "1.0",
        asset_type: "native",
      }

      let resolveNext: (value: {
        records: unknown[]
        next: typeof mockNext
        prev: typeof mockPrev
      }) => void = () => {}
      mockCall.mockResolvedValueOnce({ records: [page1Record], next: mockNext, prev: mockPrev })
      mockNext.mockReturnValueOnce(
        new Promise(resolve => {
          resolveNext = resolve
        })
      )

      const { result } = renderHook(() => usePayments({ address, limit: 1 }), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      let fetchNextDone: Promise<void>
      act(() => {
        fetchNextDone = result.current.fetchNext()
      })

      const refetchedRecord = { ...page1Record, id: "999" }
      mockCall.mockResolvedValueOnce({
        records: [refetchedRecord],
        next: mockNext,
        prev: mockPrev,
      })
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.payments[0]?.id).toBe("999")

      await act(async () => {
        resolveNext({ records: [{ ...page1Record, id: "stale" }], next: mockNext, prev: mockPrev })
        await fetchNextDone
      })

      expect(result.current.payments[0]?.id).toBe("999")
    })
  })
})
