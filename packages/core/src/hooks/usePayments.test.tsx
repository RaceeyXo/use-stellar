import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { usePayments } from "./usePayments"
import {
  nativePayment,
  createAccount,
  accountMerge,
  pathPaymentStrictReceive,
  pathPaymentStrictSend,
  invokeHostFunction,
  accountMergeEffects,
  TARGET,
  SENDER,
  RECEIVER,
  ISSUER,
} from "../__tests__/fixtures/horizon-payments"

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
}))

import { getHorizonServer } from "../utils"

const mockGetHorizonServer = getHorizonServer as jest.Mock

const mockCall = jest.fn()
const mockNext = jest.fn()
const mockPrev = jest.fn()
const mockEffectsCall = jest.fn()
const mockForOperation = jest.fn()

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
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.forAccount.mockReturnValue(mockQuery)
    mockQuery.limit.mockReturnValue(mockQuery)
    mockQuery.order.mockReturnValue(mockQuery)
    mockQuery.cursor.mockReturnValue(mockQuery)
    mockEffectsCall.mockResolvedValue({ records: accountMergeEffects })
    mockForOperation.mockReturnValue({ call: mockEffectsCall })
    mockGetHorizonServer.mockReturnValue({
      payments: () => mockQuery,
      effects: () => ({ forOperation: mockForOperation }),
    })
  })

  it("handles empty state and returns empty array", async () => {
    mockCall.mockResolvedValueOnce({ records: [] })

    const { result } = renderHook(() => usePayments({ address: TARGET }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.payments).toEqual([])
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it.each([
    {
      name: "native payment",
      record: nativePayment,
      expected: {
        id: nativePayment.id,
        txHash: nativePayment.transaction_hash,
        type: "payment",
        from: SENDER,
        to: TARGET,
        amount: "10.5",
        asset: "XLM",
        direction: "incoming",
        createdAt: nativePayment.created_at,
      },
    },
    {
      name: "create account",
      record: createAccount,
      expected: {
        id: createAccount.id,
        txHash: createAccount.transaction_hash,
        type: "create_account",
        from: SENDER,
        to: TARGET,
        amount: "1.5",
        asset: "XLM",
        direction: "incoming",
        createdAt: createAccount.created_at,
      },
    },
    {
      name: "account merge",
      record: accountMerge,
      expected: {
        id: accountMerge.id,
        txHash: accountMerge.transaction_hash,
        type: "account_merge",
        from: TARGET,
        to: RECEIVER,
        amount: "25.5",
        asset: "XLM",
        direction: "outgoing",
        createdAt: accountMerge.created_at,
      },
    },
    {
      name: "path payment strict receive",
      record: pathPaymentStrictReceive,
      expected: {
        id: pathPaymentStrictReceive.id,
        txHash: pathPaymentStrictReceive.transaction_hash,
        type: "path_payment_strict_receive",
        from: SENDER,
        to: TARGET,
        amount: "7.25",
        asset: { code: "USDC", issuer: ISSUER },
        direction: "incoming",
        createdAt: pathPaymentStrictReceive.created_at,
      },
    },
    {
      name: "path payment strict send",
      record: pathPaymentStrictSend,
      expected: {
        id: pathPaymentStrictSend.id,
        txHash: pathPaymentStrictSend.transaction_hash,
        type: "path_payment_strict_send",
        from: TARGET,
        to: RECEIVER,
        amount: "3.5",
        asset: "XLM",
        direction: "outgoing",
        createdAt: pathPaymentStrictSend.created_at,
      },
    },
    {
      name: "invoke host function",
      record: invokeHostFunction,
      expected: {
        id: invokeHostFunction.id,
        txHash: invokeHostFunction.transaction_hash,
        type: "invoke_host_function",
        from: SENDER,
        to: TARGET,
        amount: "12.0",
        asset: { code: "USDC", issuer: ISSUER },
        direction: "incoming",
        createdAt: invokeHostFunction.created_at,
      },
    },
  ])("normalizes $name", async ({ record, expected }) => {
    mockCall.mockResolvedValueOnce({ records: [record] })

    const { result } = renderHook(() => usePayments({ address: TARGET }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toEqual([expected])
  })

  it("handles pagination via fetchNext and fetchPrev", async () => {
    const page1 = {
      records: [{ ...nativePayment, id: "200" }],
      next: mockNext,
      prev: mockPrev,
    }

    const page2 = {
      records: [{ ...nativePayment, id: "201" }],
      next: mockNext,
      prev: mockPrev,
    }

    mockCall.mockResolvedValueOnce(page1)
    mockNext.mockResolvedValueOnce(page2)

    const { result } = renderHook(() => usePayments({ address: TARGET, limit: 1 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments[0].id).toBe("200")
    expect(result.current.hasNext).toBe(true)

    await act(async () => {
      await result.current.fetchNext()
    })

    expect(result.current.payments[0].id).toBe("201")
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it("handles errors gracefully", async () => {
    mockCall.mockRejectedValueOnce(new Error("Network Error"))

    const { result } = renderHook(() => usePayments({ address: TARGET }), { wrapper })

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
