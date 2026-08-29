import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useTransactionHistory } from "./useTransactionHistory"

// ── Mock ../utils ──────────────────────────────────────────────────────────
jest.mock("../utils", () => ({
  getHorizonServer: jest.fn(),
  isBrowser: jest.fn(() => true),
}))

import { getHorizonServer } from "../utils"

const mockGetHorizonServer = getHorizonServer as jest.Mock

// Fluent Horizon query builder mock: forAccount/limit/order/cursor all return
// the same builder, and call() resolves the response.
const mockCall = jest.fn()
const mockCursor = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()
const mockForAccount = jest.fn()
const mockTransactions = jest.fn()

function wireQueryBuilder() {
  const builder = {
    forAccount: mockForAccount,
    limit: mockLimit,
    order: mockOrder,
    cursor: mockCursor,
    call: mockCall,
  }
  mockForAccount.mockReturnValue(builder)
  mockLimit.mockReturnValue(builder)
  mockOrder.mockReturnValue(builder)
  mockCursor.mockReturnValue(builder)
  mockTransactions.mockReturnValue(builder)
  mockGetHorizonServer.mockReturnValue({ transactions: mockTransactions })
}

// ── Test wrapper ───────────────────────────────────────────────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

// ── Fixtures ───────────────────────────────────────────────────────────────
// Testnet address — never use mainnet addresses in tests.
const ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"

const MOCK_RECORD = {
  hash: "abc123hash",
  ledger: 12345,
  created_at: "2024-01-01T00:00:00Z",
  source_account: ACCOUNT,
  fee_charged: "100",
  operation_count: 1,
  successful: true,
  memo: "hello",
  memo_type: "text",
}

const MOCK_RECORD_2 = {
  ...MOCK_RECORD,
  hash: "def456hash",
  ledger: 12346,
  memo: undefined,
  memo_type: "none",
}

const MOCK_RECORD_3 = {
  ...MOCK_RECORD,
  hash: "ghi789hash",
  ledger: 12347,
}

function pageOf(records: unknown[]) {
  return {
    records,
    next: jest.fn(),
    prev: jest.fn(),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  wireQueryBuilder()
})

describe("useTransactionHistory — empty address", () => {
  it("returns empty transactions and does not call Horizon when address is null", () => {
    const { result } = renderHook(() => useTransactionHistory({ address: null }), { wrapper })

    expect(result.current.transactions).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
    expect(mockCall).not.toHaveBeenCalled()
  })
})

describe("useTransactionHistory — happy path", () => {
  it("normalizes Horizon records into NormalizedTransaction", async () => {
    mockCall.mockResolvedValue(pageOf([MOCK_RECORD, MOCK_RECORD_2]))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.transactions).toHaveLength(2)

    const tx = result.current.transactions[0]
    expect(tx.hash).toBe("abc123hash")
    expect(tx.ledger).toBe(12345)
    expect(tx.createdAt).toBe("2024-01-01T00:00:00Z")
    expect(tx.sourceAccount).toBe(ACCOUNT)
    expect(tx.fee).toBe("100")
    expect(tx.operationCount).toBe(1)
    expect(tx.successful).toBe(true)
    expect(tx.memo).toBe("hello")
    expect(tx.memoType).toBe("text")
  })

  it("queries Horizon with the resolved address, limit and order", async () => {
    mockCall.mockResolvedValue(pageOf([MOCK_RECORD]))

    renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 5, order: "asc" }), {
      wrapper,
    })

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(1))

    expect(mockForAccount).toHaveBeenCalledWith(ACCOUNT)
    // Hook requests limit+1 internally to detect further pages.
    expect(mockLimit).toHaveBeenCalledWith(6)
    expect(mockOrder).toHaveBeenCalledWith("asc")
    // No cursor provided on the initial fetch.
    expect(mockCursor).not.toHaveBeenCalled()
  })

  it("applies a cursor when one is provided", async () => {
    mockCall.mockResolvedValue(pageOf([MOCK_RECORD]))

    renderHook(() => useTransactionHistory({ address: ACCOUNT, cursor: "cursor-1" }), { wrapper })

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(1))
    expect(mockCursor).toHaveBeenCalledWith("cursor-1")
    // hasPrev is true because a cursor implies a previous page exists.
    expect(mockCursor).toHaveBeenCalledTimes(1)
  })

  it("returns an empty array (not an error) when there are no transactions", async () => {
    mockCall.mockResolvedValue(pageOf([]))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.transactions).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })
})

describe("useTransactionHistory — Horizon error", () => {
  it("normalizes a network failure through toStellarError", async () => {
    mockCall.mockRejectedValue(new Error("Network timeout"))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.transactions).toEqual([])
  })

  it("maps a non-Error throw to an UNKNOWN StellarError preserving the message", async () => {
    mockCall.mockRejectedValue("unexpected string error")

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error?.code).toBe("UNKNOWN")
    expect(result.current.error?.message).toBe("unexpected string error")
  })
})

describe("useTransactionHistory — pagination", () => {
  it("reports hasNext:false when exactly limit records are returned", async () => {
    // limit=2, Horizon returns exactly 2 records (limit+1 fetched, only 2
    // come back) → no further page exists, hasNext must be false.
    mockCall.mockResolvedValue(pageOf([MOCK_RECORD, MOCK_RECORD_2]))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 2 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it("reports hasNext:true when limit+1 records are returned", async () => {
    // limit=2, Horizon returns 3 records (the extra sentinel) → hasNext:true,
    // and only 2 records are exposed to the caller.
    mockCall.mockResolvedValue(pageOf([MOCK_RECORD, MOCK_RECORD_2, MOCK_RECORD_3]))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 2 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasNext).toBe(true)
    expect(result.current.transactions).toHaveLength(2)
  })

  it("fetchNext loads the next page and toggles hasPrev", async () => {
    // First page has limit+1=3 records → hasNext:true.
    const firstPage = pageOf([MOCK_RECORD, MOCK_RECORD_2, MOCK_RECORD_3])
    const secondPage = pageOf([{ ...MOCK_RECORD, hash: "jkl000hash" }])
    firstPage.next.mockResolvedValue(secondPage)
    mockCall.mockResolvedValue(firstPage)

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 2 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    // Only the first 2 records (sliced from 3) are visible.
    expect(result.current.transactions).toHaveLength(2)
    expect(result.current.hasNext).toBe(true)

    await act(async () => {
      await result.current.fetchNext()
    })

    expect(firstPage.next).toHaveBeenCalledTimes(1)
    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].hash).toBe("jkl000hash")
    expect(result.current.hasPrev).toBe(true)
  })

  it("fetchPrev loads the previous page", async () => {
    // First page has limit+1=3 records so hasPrev can be tested after nav.
    const firstPage = pageOf([MOCK_RECORD, MOCK_RECORD_2, MOCK_RECORD_3])
    const prevPage = pageOf([{ ...MOCK_RECORD, hash: "prev000hash" }])
    firstPage.prev.mockResolvedValue(prevPage)
    mockCall.mockResolvedValue(firstPage)

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 2 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.fetchPrev()
    })

    expect(firstPage.prev).toHaveBeenCalledTimes(1)
    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].hash).toBe("prev000hash")
    expect(result.current.hasNext).toBe(true)
  })

  it("fetchNext is a no-op when there is no next page", async () => {
    mockCall.mockResolvedValue(pageOf([]))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.fetchNext()
    })

    // Only the initial fetch ran; no page navigation occurred.
    expect(mockCall).toHaveBeenCalledTimes(1)
    expect(result.current.transactions).toEqual([])
  })

  it("landing on an empty page keeps current page visible and allows fetchPrev", async () => {
    // First page: limit+1=3 records → hasNext:true, 2 exposed.
    const firstPage = pageOf([MOCK_RECORD, MOCK_RECORD_2, MOCK_RECORD_3])
    // Next page: 0 records (e.g. records deleted between pages).
    const emptyPage = pageOf([])
    // Prev from the empty page should bring us back to first-page data.
    const backPage = pageOf([{ ...MOCK_RECORD, hash: "back000hash" }])
    firstPage.next.mockResolvedValue(emptyPage)
    emptyPage.next.mockResolvedValue(emptyPage)
    emptyPage.prev.mockResolvedValue(backPage)
    mockCall.mockResolvedValue(firstPage)

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 2 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.transactions).toHaveLength(2)

    // Navigate into the empty page.
    await act(async () => {
      await result.current.fetchNext()
    })

    // Current page is still displayed (empty-page UX: keep previous page).
    expect(result.current.transactions).toHaveLength(2)
    expect(result.current.hasNext).toBe(false)
    // hasPrev must still be true — we can go back.
    expect(result.current.hasPrev).toBe(true)

    // Navigate back — fetchPrev must work even after the empty-page step.
    await act(async () => {
      await result.current.fetchPrev()
    })

    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].hash).toBe("back000hash")
  })

  it("hasPrev boundary: exactly limit records on prev returns hasPrev:false", async () => {
    // First page with 3 records (limit+1) → hasNext:true.
    const firstPage = pageOf([MOCK_RECORD, MOCK_RECORD_2, MOCK_RECORD_3])
    // After fetchNext, call fetchPrev which returns exactly limit=2 records
    // (no extra sentinel) → hasPrev:false.
    const nextPage = pageOf([
      { ...MOCK_RECORD, hash: "page2a" },
      { ...MOCK_RECORD, hash: "page2b" },
    ])
    const prevPageExact = pageOf([
      { ...MOCK_RECORD, hash: "prevA" },
      { ...MOCK_RECORD, hash: "prevB" },
    ])
    firstPage.next.mockResolvedValue(nextPage)
    nextPage.prev.mockResolvedValue(prevPageExact)
    mockCall.mockResolvedValue(firstPage)

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT, limit: 2 }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.fetchNext()
    })
    await act(async () => {
      await result.current.fetchPrev()
    })

    // prevPageExact returned exactly 2 records (== limit, not > limit)
    // → hasPrev must be false.
    expect(result.current.hasPrev).toBe(false)
    expect(result.current.transactions).toHaveLength(2)
  })
})

describe("useTransactionHistory — refetch", () => {
  it("re-calls Horizon when refetch() is invoked", async () => {
    mockCall.mockResolvedValue(pageOf([MOCK_RECORD]))

    const { result } = renderHook(() => useTransactionHistory({ address: ACCOUNT }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockCall).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(2))
  })
})
