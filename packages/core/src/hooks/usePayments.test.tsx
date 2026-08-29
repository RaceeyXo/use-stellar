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

// Testnet address — never use mainnet addresses in tests.
const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"

// Helper: build a page response with working next/prev mocks.
function pageOf(records: unknown[]) {
  const page = {
    records,
    next: jest.fn(),
    prev: jest.fn(),
  }
  return page
}

// A minimal payment record fixture (native XLM, incoming).
function makePayment(id: string) {
  return {
    id,
    type: "payment",
    transaction_hash: `tx_${id}`,
    created_at: "2024-01-01T00:00:00Z",
    from: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
    to: ADDRESS,
    amount: "1.0",
    asset_type: "native",
  }
}

describe("usePayments", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery.forAccount.mockReturnValue(mockQuery)
    mockQuery.limit.mockReturnValue(mockQuery)
    mockQuery.order.mockReturnValue(mockQuery)
    mockQuery.cursor.mockReturnValue(mockQuery)
    mockGetHorizonServer.mockReturnValue({ payments: () => mockQuery })
  })

  // ── Basic behaviour ────────────────────────────────────────────────────

  it("handles empty state and returns empty array", async () => {
    mockCall.mockResolvedValueOnce(pageOf([]))

    const { result } = renderHook(() => usePayments({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.payments).toEqual([])
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it("requests limit+1 records from Horizon internally", async () => {
    mockCall.mockResolvedValueOnce(pageOf([makePayment("1")]))

    renderHook(() => usePayments({ address: ADDRESS, limit: 5 }), { wrapper })

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(1))
    // Hook passes limit+1 to the query builder.
    expect(mockQuery.limit).toHaveBeenCalledWith(6)
  })

  it("normalizes native XLM payment operations", async () => {
    const rawRecords = [
      {
        id: "100",
        type: "payment",
        transaction_hash: "tx_1",
        created_at: "2026-06-25T18:00:00Z",
        from: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
        to: ADDRESS,
        amount: "10.5",
        asset_type: "native",
      },
    ]

    mockCall.mockResolvedValueOnce(pageOf(rawRecords))

    const { result } = renderHook(() => usePayments({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0]).toEqual({
      id: "100",
      txHash: "tx_1",
      type: "payment",
      from: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
      to: ADDRESS,
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
        from: ADDRESS,
        to: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
        amount: "500.0",
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
      },
    ]

    mockCall.mockResolvedValueOnce(pageOf(rawRecords))

    const { result } = renderHook(() => usePayments({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0]).toEqual({
      id: "101",
      txHash: "tx_2",
      type: "payment",
      from: ADDRESS,
      to: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
      amount: "500.0",
      asset: { code: "USDC", issuer: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM" },
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
        funder: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
        account: ADDRESS,
        starting_balance: "1.5",
      },
      {
        id: "103",
        type: "account_merge",
        transaction_hash: "tx_4",
        created_at: "2026-06-25T18:03:00Z",
        account: ADDRESS,
        into: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
        amount: "2.5",
      },
    ]

    mockCall.mockResolvedValueOnce(pageOf(rawRecords))

    const { result } = renderHook(() => usePayments({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(2)
    expect(result.current.payments[0].type).toBe("create_account")
    expect(result.current.payments[0].direction).toBe("incoming")
    expect(result.current.payments[0].asset).toBe("XLM")

    expect(result.current.payments[1].type).toBe("account_merge")
    expect(result.current.payments[1].direction).toBe("outgoing")
    expect(result.current.payments[1].asset).toBe("XLM")
  })

  it("handles errors gracefully", async () => {
    mockCall.mockRejectedValueOnce(new Error("Network Error"))

    const { result } = renderHook(() => usePayments({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.payments).toEqual([])
  })

  // ── Pagination heuristic ───────────────────────────────────────────────

  it("reports hasNext:false when exactly limit records are returned", async () => {
    // limit=2, Horizon returns exactly 2 records (limit+1 fetched internally,
    // only 2 come back) → no further page, hasNext must be false.
    mockCall.mockResolvedValueOnce(pageOf([makePayment("a"), makePayment("b")]))

    const { result } = renderHook(() => usePayments({ address: ADDRESS, limit: 2 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it("reports hasNext:true when limit+1 records are returned", async () => {
    // limit=2, Horizon returns 3 records (the extra sentinel) → hasNext:true,
    // and only 2 records are exposed to the caller.
    mockCall.mockResolvedValueOnce(pageOf([makePayment("a"), makePayment("b"), makePayment("c")]))

    const { result } = renderHook(() => usePayments({ address: ADDRESS, limit: 2 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasNext).toBe(true)
    expect(result.current.payments).toHaveLength(2)
  })

  it("handles pagination via fetchNext — advances page and sets hasPrev", async () => {
    // First page: limit+1=2 records for limit=1 → hasNext:true.
    const page1 = pageOf([makePayment("p1a"), makePayment("p1b")])
    const page2 = pageOf([makePayment("p2a")])
    page1.next.mockResolvedValue(page2)
    mockCall.mockResolvedValueOnce(page1)

    const { result } = renderHook(() => usePayments({ address: ADDRESS, limit: 1 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0].id).toBe("p1a")
    expect(result.current.hasNext).toBe(true)

    await act(async () => {
      await result.current.fetchNext()
    })

    expect(result.current.payments[0].id).toBe("p2a")
    expect(page1.next).toHaveBeenCalledTimes(1)
    expect(result.current.hasPrev).toBe(true)
  })

  it("landing on an empty page keeps current page visible and allows fetchPrev", async () => {
    // First page: limit+1=3 records for limit=2 → hasNext:true, 2 exposed.
    const firstPage = pageOf([makePayment("f1"), makePayment("f2"), makePayment("f3")])
    // Next page: 0 records (records deleted between fetches).
    const emptyPage = pageOf([])
    // Prev from the empty page should bring us back.
    const backPage = pageOf([makePayment("back1")])
    firstPage.next.mockResolvedValue(emptyPage)
    emptyPage.next.mockResolvedValue(emptyPage)
    emptyPage.prev.mockResolvedValue(backPage)
    mockCall.mockResolvedValueOnce(firstPage)

    const { result } = renderHook(() => usePayments({ address: ADDRESS, limit: 2 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments).toHaveLength(2)

    // Navigate into the empty page.
    await act(async () => {
      await result.current.fetchNext()
    })

    // Current page is still displayed (empty-page UX: keep previous page).
    expect(result.current.payments).toHaveLength(2)
    expect(result.current.hasNext).toBe(false)
    // hasPrev must still be true — we can go back.
    expect(result.current.hasPrev).toBe(true)

    // Navigate back — fetchPrev must work even after the empty-page step.
    await act(async () => {
      await result.current.fetchPrev()
    })

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.payments[0].id).toBe("back1")
  })

  it("hasPrev boundary: exactly limit records on prev returns hasPrev:false", async () => {
    // First page: limit+1=3 records → hasNext:true.
    const firstPage = pageOf([makePayment("f1"), makePayment("f2"), makePayment("f3")])
    // Next page with 2 records (limit=2, no extra sentinel).
    const nextPage = pageOf([makePayment("n1"), makePayment("n2")])
    // Prev from next page returns exactly limit=2 records → hasPrev:false.
    const prevPageExact = pageOf([makePayment("pv1"), makePayment("pv2")])
    firstPage.next.mockResolvedValue(nextPage)
    nextPage.prev.mockResolvedValue(prevPageExact)
    mockCall.mockResolvedValueOnce(firstPage)

    const { result } = renderHook(() => usePayments({ address: ADDRESS, limit: 2 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.fetchNext()
    })
    await act(async () => {
      await result.current.fetchPrev()
    })

    // prevPageExact returned exactly limit records (not > limit) → hasPrev:false.
    expect(result.current.hasPrev).toBe(false)
    expect(result.current.payments).toHaveLength(2)
  })
})
