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
 * ### Pagination heuristic
 * Internally this hook requests `limit + 1` records from Horizon on every
 * fetch. If the response contains more than `limit` records a further page
 * exists (`hasNext === true` / `hasPrev === true`); only the first `limit`
 * records are exposed to callers. This avoids the off-by-one error of the
 * naïve `records.length >= limit` test, which incorrectly reports
 * `hasNext: true` when the account's total record count is an exact multiple
 * of the page size.
 *
 * ### Empty-page behaviour
 * When `fetchNext` or `fetchPrev` lands on a page that contains zero records
 * (possible if records are deleted between pages), the hook **keeps the
 * previously displayed page** and simply sets `hasNext: false` /
 * `hasPrev: false` as appropriate. The cursor refs are updated independently
 * of the record count so that navigation back via `fetchPrev` / `fetchNext`
 * always remains available whenever Horizon provides the corresponding cursor.
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
  // Store page navigation functions from the Horizon response
  const nextRef = useRef<(() => Promise<TransactionPage>) | null>(null)
  const prevRef = useRef<(() => Promise<TransactionPage>) | null>(null)

  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)

  // Monotonic id shared by fetchTransactions/fetchNext/fetchPrev — whichever
  // of the three started most recently owns the state writes below, so a
  // slower, superseded response (from any of the three) is discarded.
  // Distinct from unmount cancellation below — a superseded fetch is
  // discarded because a newer fetch owns the state, while a cancelled fetch
  // is discarded because there is no component left to update.
  const requestRef = useRef(0)
  // Set only by the effect cleanup on unmount. Reset at the top of the
  // effect so it doesn't leak across re-runs.
  const cancelledRef = useRef(false)

  const fetchTransactions = useCallback(async () => {
    if (!resolvedAddress) {
      setTransactions([])
      setHasNext(false)
      setHasPrev(false)
      setLoading(false)
      return
    }

    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      const server = getHorizonServer(network)
      let query = server.transactions().forAccount(resolvedAddress).limit(limit).order(order)
      if (cursor) {
        query = query.cursor(cursor)
      }
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<StellarError | null>(null)
  // Override transactions for paginated responses beyond the first page.
  const [pageTransactions, setPageTransactions] = useState<NormalizedTransaction[] | null>(null)
  const [pageHasNext, setPageHasNext] = useState<boolean | null>(null)
  const [pageHasPrev, setPageHasPrev] = useState<boolean | null>(null)

  const {
    data,
    loading: cacheLoading,
    error: rawError,
    refetch,
  } = useQuery<PageData>({
    queryKey: queryKeyArr,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      // Request limit+1 to detect whether a further page exists without
      // relying on the record-count >= limit heuristic.
      let query = server
        .transactions()
        .forAccount(resolvedAddress!)
        .limit(limit + 1)
        .order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(normalizeTransaction)

      // Set cursor refs unconditionally — they depend on Horizon's response,
      // not on whether this particular page happened to be non-empty.
      nextRef.current = () => res.next()
      prevRef.current = () => res.prev()
      const requestAddress = resolvedAddress
      if (!requestAddress) throw new Error("Address is required")

      let query = server.transactions().forAccount(requestAddress).limit(limit).order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()

      if (cancelledRef.current || fetchId !== requestRef.current) return

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

      setHasNext(res.records.length >= limit)
      setHasPrev(!!cursor)
    } catch (err) {
      if (cancelledRef.current || fetchId !== requestRef.current) return
      setError(toStellarError(err))
    } finally {
      if (!cancelledRef.current && fetchId === requestRef.current) {
        setLoading(false)
      }
    }
  }, [resolvedAddress, network, limit, order, cursor])

  const fetchNext = useCallback(async () => {
    if (!nextRef.current) return
    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)
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
    
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.next()
      const res = await nextRef.current()
      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(normalizeTransaction)

      // Update cursor refs independently of record count so that landing on
      // an empty page never loses the ability to navigate back.
      nextRef.current = () => res.next()
      prevRef.current = () => res.prev()

      if (normalized.length > 0) {
        // Normal case: render the new page.
        setPageTransactions(normalized)
      }
      // Empty-page UX: if zero records came back, keep the current page
      // displayed and just reflect the updated navigation state.
      setPageHasNext(hasNext)
      setPageHasPrev(true)

      if (cancelledRef.current || fetchId !== requestRef.current) return

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
      if (cancelledRef.current || fetchId !== requestRef.current) return
      setError(toStellarError(err))
    } finally {
      if (!cancelledRef.current && fetchId === requestRef.current) {
        setLoading(false)
      }
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [pageState.queryKey, pageState.next, currentQueryKey, limit])

  const fetchPrev = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.prev) return
    
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.prev()
    if (!prevRef.current) return
    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await prevRef.current()
      // Request limit+1 for prev too so hasPrev is symmetrically accurate.
      const hasPrev = res.records.length > limit
      const records = hasPrev ? res.records.slice(0, limit) : res.records
      const normalized = records.map(normalizeTransaction)

      // Update cursor refs independently of record count.
      nextRef.current = () => res.next()
      prevRef.current = () => res.prev()

      if (normalized.length > 0) {
        setPageTransactions(normalized)
      }
      setPageHasNext(true)
      setPageHasPrev(hasPrev)

      if (cancelledRef.current || fetchId !== requestRef.current) return

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
      if (cancelledRef.current || fetchId !== requestRef.current) return
      setError(toStellarError(err))
    } finally {
      if (!cancelledRef.current && fetchId === requestRef.current) {
        setLoading(false)
      }
    }
  }, [limit])

  useEffect(() => {
    cancelledRef.current = false
    fetchTransactions()
    return () => {
      cancelledRef.current = true
    }
  }, [fetchTransactions])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
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