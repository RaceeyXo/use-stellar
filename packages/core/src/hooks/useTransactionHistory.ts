import { useCallback, useRef, useState } from "react"
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

// ── Normalize ──────────────────────────────────────────────────────────────
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

  const queryKey = resolvedAddress
    ? transactionHistoryKey(
        networkConfig.horizonUrl,
        network,
        resolvedAddress,
        limit,
        order,
        cursor
      )
    : (["transactionHistory", "disabled"] as const)

  // Store page navigation functions from the Horizon response
  const nextRef = useRef<(() => Promise<TransactionPage>) | null>(null)
  const prevRef = useRef<(() => Promise<TransactionPage>) | null>(null)

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
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      let query = server.transactions().forAccount(resolvedAddress!).limit(limit).order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const normalized = res.records.map(normalizeTransaction)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      return {
        transactions: normalized,
        hasNext: res.records.length >= limit,
        hasPrev: !!cursor,
      }
    },
    store: queryStore,
    enabled: Boolean(resolvedAddress),
  })

  // Reset page overrides when the base query changes.
  const keyStr = JSON.stringify(queryKey)
  const prevKeyRef = useRef(keyStr)
  if (prevKeyRef.current !== keyStr) {
    prevKeyRef.current = keyStr
    setPageTransactions(null)
    setPageHasNext(null)
    setPageHasPrev(null)
  }

  const fetchNext = useCallback(async () => {
    if (!nextRef.current) return
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await nextRef.current()
      const normalized = res.records.map(normalizeTransaction)
      setPageTransactions(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(res.records.length >= limit)
      setPageHasPrev(true)
    } catch (err) {
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [limit])

  const fetchPrev = useCallback(async () => {
    if (!prevRef.current) return
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await prevRef.current()
      const normalized = res.records.map(normalizeTransaction)
      setPageTransactions(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(true)
      setPageHasPrev(res.records.length >= limit)
    } catch (err) {
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [limit])

  const error = pageError ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageLoading || cacheLoading

  return {
    transactions: pageTransactions ?? data?.transactions ?? [],
    loading,
    error,
    refetch,
    fetchNext,
    fetchPrev,
    hasNext: pageHasNext ?? data?.hasNext ?? false,
    hasPrev: pageHasPrev ?? data?.hasPrev ?? false,
  }
}
