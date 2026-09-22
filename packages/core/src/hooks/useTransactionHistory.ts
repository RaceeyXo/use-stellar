// packages/core/src/hooks/useTransactionHistory.ts

import { useCallback, useReducer, useRef } from "react"
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
      /**
       * Page navigation only: when the new page came back empty, keep the
       * page already on screen and update just the navigation state, so a
       * user who steps past the end is not shown a blank list.
       */
      keepCurrentWhenEmpty?: boolean
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
        transactions:
          action.keepCurrentWhenEmpty && action.transactions.length === 0
            ? state.transactions
            : action.transactions,
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

  // Monotonic request id. A page navigation captures it at the start and
  // discards its own response if a newer navigation or refetch has since
  // claimed the display — the reducer's queryKey check cannot catch this,
  // because a refetch does not change the key.
  const requestRef = useRef(0)

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

      // Ask for one more than the caller wants: if Horizon returns it, another
      // page exists. The naive `records.length >= limit` test reports
      // `hasNext: true` whenever the total is an exact multiple of the page
      // size, stranding the user on an empty final page.
      let query = server
        .transactions()
        .forAccount(requestAddress)
        .limit(limit + 1)
        .order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(normalizeTransaction)

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        transactions: normalized,
        // Cursor callbacks are set from Horizon's response regardless of record
        // count, so landing on an empty page never loses the way back.
        next: () => res.next(),
        prev: () => res.prev(),
        hasNext,
        hasPrev: !!cursor,
      })

      return {
        transactions: normalized,
        hasNext,
        hasPrev: !!cursor,
      }
    },
    store: queryStore,
    enabled: Boolean(resolvedAddress),
  })

  const fetchNext = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.next) return

    const fetchId = ++requestRef.current
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.next()
      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(normalizeTransaction)

      if (fetchId !== requestRef.current) return

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        transactions: normalized,
        next: () => res.next(),
        prev: () => res.prev(),
        hasNext,
        hasPrev: true,
        keepCurrentWhenEmpty: true,
      })
    } catch (err) {
      if (fetchId !== requestRef.current) return
      const stellarError = toStellarError(err)
      // `toStellarError` returns null for an abort, which is a deliberate
      // cancellation rather than a failure — leave the page state untouched.
      if (!stellarError) return
      dispatch({
        type: "FETCH_ERROR",
        queryKey: currentQueryKey,
        error: stellarError,
      })
    }
  }, [pageState, currentQueryKey, limit])

  const fetchPrev = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.prev) return

    const fetchId = ++requestRef.current
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.prev()
      const hasPrev = res.records.length > limit
      const records = hasPrev ? res.records.slice(0, limit) : res.records
      const normalized = records.map(normalizeTransaction)

      if (fetchId !== requestRef.current) return

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        transactions: normalized,
        next: () => res.next(),
        prev: () => res.prev(),
        hasNext: true,
        hasPrev,
        keepCurrentWhenEmpty: true,
      })
    } catch (err) {
      if (fetchId !== requestRef.current) return
      const stellarError = toStellarError(err)
      // `toStellarError` returns null for an abort, which is a deliberate
      // cancellation rather than a failure — leave the page state untouched.
      if (!stellarError) return
      dispatch({
        type: "FETCH_ERROR",
        queryKey: currentQueryKey,
        error: stellarError,
      })
    }
  }, [pageState, currentQueryKey, limit])

  /** Drops any page navigation and supersedes in-flight page fetches. */
  const refetchLatest = useCallback(() => {
    requestRef.current += 1
    dispatch({ type: "RESET", queryKey: currentQueryKey })
    refetch()
  }, [currentQueryKey, refetch])

  const error = pageState.error ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageState.loading || cacheLoading

  return {
    transactions: pageState.transactions ?? data?.transactions ?? [],
    loading,
    error,
    refetch: refetchLatest,
    fetchNext,
    fetchPrev,
    hasNext: pageState.hasNext ?? data?.hasNext ?? false,
    hasPrev: pageState.hasPrev ?? data?.hasPrev ?? false,
  }
}
