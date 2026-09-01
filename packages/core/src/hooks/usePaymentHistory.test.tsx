import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { usePaymentHistory } from "./usePaymentHistory"

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
}))

import { getHorizonServer } from "../utils"

const mockGetHorizonServer = getHorizonServer as jest.Mock

const mockCall = jest.fn()
const mockNext = jest.fn()

const mockQuery = {
  forAccount: jest.fn(),
  limit: jest.fn(),
  order: jest.fn(),
  cursor: jest.fn(),
  call: mockCall,
}

const ADDRESS = "G_TARGET"
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

// A native payment sent TO the account (incoming).
function nativeIncoming(overrides: Record<string, unknown> = {}) {
  return {
    id: "100",
    type: "payment",
    transaction_hash: "tx_1",
    created_at: "2026-06-25T18:00:00Z",
    from: "G_SENDER",
    to: ADDRESS,
    amount: "10.5",
    asset_type: "native",
    ...overrides,
  }
}

// An issued-asset payment sent FROM the account (outgoing).
function issuedOutgoing(overrides: Record<string, unknown> = {}) {
  return {
    id: "101",
    type: "payment",
    transaction_hash: "tx_2",
    created_at: "2026-06-25T18:01:00Z",
    from: ADDRESS,
    to: "G_RECEIVER",
    amount: "500.0",
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: USDC_ISSUER,
    ...overrides,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

beforeEach(() => {
  jest.clearAllMocks()
  mockQuery.forAccount.mockReturnValue(mockQuery)
  mockQuery.limit.mockReturnValue(mockQuery)
  mockQuery.order.mockReturnValue(mockQuery)
  mockQuery.cursor.mockReturnValue(mockQuery)
  mockGetHorizonServer.mockReturnValue({ payments: () => mockQuery })
})

describe("usePaymentHistory", () => {
  it("returns all payments when no filters are applied", async () => {
    mockCall.mockResolvedValueOnce({ records: [nativeIncoming(), issuedOutgoing()] })

    const { result } = renderHook(() => usePaymentHistory({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(2)
    expect(result.current.payments[0]).toEqual({
      id: "100",
      txHash: "tx_1",
      type: "payment",
      from: "G_SENDER",
      to: ADDRESS,
      amount: "10.5",
      asset: "XLM",
      direction: "incoming",
      createdAt: "2026-06-25T18:00:00Z",
    })
    expect(result.current.error).toBeNull()
  })

  it("returns an empty list when the account has no payments", async () => {
    mockCall.mockResolvedValueOnce({ records: [] })

    const { result } = renderHook(() => usePaymentHistory({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toEqual([])
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it("does not fetch when no address resolves", async () => {
    const { result } = renderHook(() => usePaymentHistory({}), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockCall).not.toHaveBeenCalled()
    expect(result.current.payments).toEqual([])
  })

  it("propagates a Horizon error", async () => {
    mockCall.mockRejectedValueOnce(new Error("Network Error"))

    const { result } = renderHook(() => usePaymentHistory({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.payments).toEqual([])
  })

  it("filters to incoming payments only", async () => {
    mockCall.mockResolvedValueOnce({ records: [nativeIncoming(), issuedOutgoing()] })

    const { result } = renderHook(
      () => usePaymentHistory({ address: ADDRESS, direction: "incoming" }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0].id).toBe("100")
    expect(result.current.payments[0].direction).toBe("incoming")
  })

  it("filters to outgoing payments only", async () => {
    mockCall.mockResolvedValueOnce({ records: [nativeIncoming(), issuedOutgoing()] })

    const { result } = renderHook(
      () => usePaymentHistory({ address: ADDRESS, direction: "outgoing" }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0].id).toBe("101")
    expect(result.current.payments[0].direction).toBe("outgoing")
  })

  it("filters to native (XLM) payments only", async () => {
    mockCall.mockResolvedValueOnce({ records: [nativeIncoming(), issuedOutgoing()] })

    const { result } = renderHook(() => usePaymentHistory({ address: ADDRESS, asset: "XLM" }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0].asset).toBe("XLM")
  })

  it("filters to a specific issued asset", async () => {
    mockCall.mockResolvedValueOnce({ records: [nativeIncoming(), issuedOutgoing()] })

    const { result } = renderHook(
      () => usePaymentHistory({ address: ADDRESS, asset: { code: "USDC", issuer: USDC_ISSUER } }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0].asset).toEqual({ code: "USDC", issuer: USDC_ISSUER })
  })

  it("excludes an issued asset when the issuer differs", async () => {
    mockCall.mockResolvedValueOnce({ records: [issuedOutgoing()] })

    const { result } = renderHook(
      () =>
        usePaymentHistory({
          address: ADDRESS,
          asset: {
            code: "USDC",
            issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toEqual([])
  })

  it("turns off hasNext when the underlying page has more, but filtering empties the list", async () => {
    // limit 1 with an outgoing record: usePayments reports hasNext, but the
    // incoming filter drops the only payment, so a "Next" button would be
    // misleading.
    mockCall.mockResolvedValueOnce({ records: [issuedOutgoing()], next: mockNext })

    const { result } = renderHook(
      () => usePaymentHistory({ address: ADDRESS, direction: "incoming", limit: 1 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toEqual([])
    expect(result.current.hasNext).toBe(false)
  })

  it("keeps hasNext true when a filtered page is non-empty and more pages exist", async () => {
    mockCall.mockResolvedValueOnce({
      records: [nativeIncoming(), issuedOutgoing()],
      next: mockNext,
    })

    const { result } = renderHook(
      () => usePaymentHistory({ address: ADDRESS, direction: "incoming", limit: 1 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.hasNext).toBe(true)
  })

  it("passes pagination through to the next page", async () => {
    const page1 = { records: [nativeIncoming()], next: mockNext }
    const page2 = { records: [issuedOutgoing()], next: mockNext }

    mockCall.mockResolvedValueOnce(page1)
    mockNext.mockResolvedValueOnce(page2)

    const { result } = renderHook(() => usePaymentHistory({ address: ADDRESS, limit: 1 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments[0].id).toBe("100")

    await act(async () => {
      await result.current.fetchNext()
    })

    expect(result.current.payments[0].id).toBe("101")
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it("unmounts cleanly while a request is in flight", async () => {
    let resolveCall: (value: unknown) => void = () => {}
    const pending = new Promise(resolve => {
      resolveCall = resolve
    })
    mockCall.mockReturnValueOnce(pending)

    const { result, unmount } = renderHook(() => usePaymentHistory({ address: ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(true))

    unmount()

    await act(async () => {
      resolveCall({ records: [nativeIncoming()] })
    })
  })
})
