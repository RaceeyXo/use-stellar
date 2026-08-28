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
})
