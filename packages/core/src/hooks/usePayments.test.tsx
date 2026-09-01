// packages/core/src/hooks/useTransactionHistory.ts

import { useCallback, useReducer } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { useQuery, transactionHistoryKey } from "../cache"
import type {
  UseTransactionHistoryOptions,
  UseTransactionHistoryReturn,
  NormalizedTransaction,
  StellarError,
} from "../types"
import type { Horizon } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"

type TransactionRecord = Horizon.ServerApi.TransactionRecord
type TransactionPage = Horizon.ServerApi.CollectionPage<TransactionRecord>

function normalizeTransaction(record: TransactionRecord): NormalizedTransaction {
  return {
    hash: record.hash,
    ledger: Number(record.ledger),
    createdAt: record.created_at,
    sourceAccount: record.source_account,
    fee: String(record.fee_charged),
    operationCount: record.operation_count,
    successful: record.successful,
    memo: record.memo,
    memoType: record.memo_type,
  }
}

const mockGetHorizonServer = getHorizonServer as jest.Mock

const mockCall = jest.fn()
interface PageData {
  transactions: NormalizedTransaction[]
  hasNext: boolean
  hasPrev: boolean
}

interface PaginationState {
  queryKey: string
  transactions: NormalizedTransaction[] | null
  next: (() => Promise<TransactionPage>) | null
  prev: (() => Promise<TransactionPage>) | null
  hasNext: boolean | null
  hasPrev: boolean | null
  loading: boolean
  error: StellarError | null
}

type PaginationAction =
  | { type: "RESET"; queryKey: string }
  | { type: "FETCH_START"; queryKey: string }
  | {
      type: "FETCH_SUCCESS"
      queryKey: string
      transactions: NormalizedTransaction[]
      next: (() => Promise<TransactionPage>) | null
      prev: (() => Promise<TransactionPage>) | null
      hasNext: boolean
      hasPrev: boolean
    }
  | { type: "FETCH_ERROR"; queryKey: string; error: StellarError }

function paginationReducer(state: PaginationState, action: PaginationAction): PaginationState {
  switch (action.type) {
    case "RESET":
      return {
        queryKey: action.queryKey,
        transactions: null,
        next: null,
        prev: null,
        hasNext: null,
        hasPrev: null,
        loading: false,
        error: null,
      }
    case "FETCH_START":
      if (state.queryKey !== action.queryKey) return state
      return { ...state, loading: true, error: null }
    case "FETCH_SUCCESS":
      if (state.queryKey !== action.queryKey) return state
      return {
        ...state,
        loading: false,
        transactions: action.transactions,
        next: action.next,
        prev: action.prev,
        hasNext: action.hasNext,
        hasPrev: action.hasPrev,
      }
    case "FETCH_ERROR":
      if (state.queryKey !== action.queryKey) return state
      return { ...state, loading: false, error: action.error, transactions: [] }
    default:
      return state
  }
}

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
/**
 * Fetches an account's transaction history with pagination.
 *
 * The first page is cached in the shared QueryStore. Pagination calls bypass
 * the cache (each page is a unique cursor-based fetch).
 *
 * @example
 * const { transactions, fetchNext } = useTransactionHistory({ address: "G..." })
 */
export function useTransactionHistory({
  address,
  limit = 10,
  order = "desc",
  cursor,
}: UseTransactionHistoryOptions = {}): UseTransactionHistoryReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKeyArr = resolvedAddress
    ? transactionHistoryKey(
        networkConfig.horizonUrl,
        network,
        resolvedAddress,
        limit,
        order,
        cursor
      )
    : (["transactionHistory", "disabled"] as const)
  const currentQueryKey = JSON.stringify(queryKeyArr)

  const [pageState, dispatch] = useReducer(paginationReducer, {
    queryKey: currentQueryKey,
    transactions: null,
    next: null,
    prev: null,
    hasNext: null,
    hasPrev: null,
    loading: false,
    error: null,
  })

  if (pageState.queryKey !== currentQueryKey) {
    dispatch({ type: "RESET", queryKey: currentQueryKey })
  }

  const {
    data,
    loading: cacheLoading,
    error: rawError,
    refetch,
  } = useQuery<PageData>({
    queryKey: queryKeyArr,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      const requestAddress = resolvedAddress
      if (!requestAddress) throw new Error("Address is required")

      let query = server.transactions().forAccount(requestAddress).limit(limit).order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const normalized = res.records.map(normalizeTransaction)

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        transactions: normalized,
        next: res.records.length > 0 ? () => res.next() : null,
        prev: res.records.length > 0 ? () => res.prev() : null,
        hasNext: res.records.length >= limit,
        hasPrev: !!cursor,
      })

      return {
        transactions: normalized,
        hasNext: res.records.length >= limit,
        hasPrev: !!cursor,
      }
    },
    store: queryStore,
    enabled: Boolean(resolvedAddress),
  })

  const fetchNext = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.next) return
    
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.next()
      const normalized = res.records.map(normalizeTransaction)

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        transactions: normalized,
        next: res.records.length > 0 ? () => res.next() : null,
        prev: res.records.length > 0 ? () => res.prev() : null,
        hasNext: res.records.length >= limit,
        hasPrev: true,
      })
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        queryKey: currentQueryKey,
        error: toStellarError(err),
      })
    }
  }, [pageState.queryKey, pageState.next, currentQueryKey, limit])

  const fetchPrev = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.prev) return
    
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.prev()
      const normalized = res.records.map(normalizeTransaction)

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        transactions: normalized,
        next: res.records.length > 0 ? () => res.next() : null,
        prev: res.records.length > 0 ? () => res.prev() : null,
        hasNext: true,
        hasPrev: res.records.length >= limit,
      })
    } catch (err) {
      dispatch({
        type: "FETCH_ERROR",
        queryKey: currentQueryKey,
        error: toStellarError(err),
      })
    }
  }, [pageState.queryKey, pageState.prev, currentQueryKey, limit])

  const error = pageState.error ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageState.loading || cacheLoading

  return {
    transactions: pageState.transactions ?? data?.transactions ?? [],
    loading,
    error,
    refetch,
    fetchNext,
    fetchPrev,
    hasNext: pageState.hasNext ?? data?.hasNext ?? false,
    hasPrev: pageState.hasPrev ?? data?.hasPrev ?? false,
  }
}

    mockCall.mockResolvedValueOnce(page1)
    mockNext.mockResolvedValueOnce(page2)

    const { result } = renderHook(() => usePayments({ address, limit: 1 }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.payments[0].id).toBe("200")
    expect(result.current.hasNext).toBe(true)

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
    // Fetch next page
    await act(async () => {
      await result.current.fetchNext()
    })

    expect(result.current.payments[0].id).toBe("201")
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it("handles errors gracefully", async () => {
    mockCall.mockRejectedValueOnce(new Error("Network Error"))

    const { result } = renderHook(() => usePayments({ address: ADDRESS }), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.payments).toEqual([])
  })

  describe("stale-while-revalidate", () => {
    const paymentRecord = {
      id: "100",
      type: "payment",
      from: "GBVZZ3DKZOPZB7DKGXMPNKKNKZYWVJJZAJABVQMMK63ZNQTXJXJXKJVM",
      to: ADDRESS,
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
      rerender({ addr: "G_OTHER_TARGET" })

      // Cleared synchronously — before the new fetch has resolved.
      expect(result.current.payments).toEqual([])

      await act(async () => {
        resolveSecond({ records: [] })
      })

      expect(result.current.loading).toBe(false)
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
