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

      return {
        transactions: normalized,
        hasNext,
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
