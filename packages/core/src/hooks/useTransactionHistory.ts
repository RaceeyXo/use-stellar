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