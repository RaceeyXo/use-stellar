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
