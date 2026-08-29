import { useCallback, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { useQuery, paymentsKey } from "../cache"
import type {
  UsePaymentsOptions,
  UsePaymentsReturn,
  NormalizedPayment,
  Asset,
  StellarError,
} from "../types"
import type { Horizon } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"

type PaymentRecord =
  | Horizon.ServerApi.PaymentOperationRecord
  | Horizon.ServerApi.CreateAccountOperationRecord
  | Horizon.ServerApi.AccountMergeOperationRecord
  | Horizon.ServerApi.PathPaymentOperationRecord
  | Horizon.ServerApi.PathPaymentStrictSendOperationRecord
  | Horizon.ServerApi.InvokeHostFunctionOperationRecord

interface PageData {
  payments: NormalizedPayment[]
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Fetches an account's payment operations with pagination.
 *
 * The first page is cached in the shared QueryStore.
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
 * const { payments, fetchNext } = usePayments({ address: "G..." })
 */
export function usePayments({
  address,
  limit = 10,
  order = "desc",
  cursor,
}: UsePaymentsOptions = {}): UsePaymentsReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKey = resolvedAddress
    ? paymentsKey(networkConfig.horizonUrl, network, resolvedAddress, limit, order, cursor)
    : (["payments", "disabled"] as const)

  // Store page navigation functions from the Horizon response
  const nextRef = useRef<(() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null>(
    null
  )
  const prevRef = useRef<(() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null>(
    null
  )

  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<StellarError | null>(null)
  const [pagePayments, setPagePayments] = useState<NormalizedPayment[] | null>(null)
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
        .payments()
        .forAccount(resolvedAddress!)
        .limit(limit + 1)
        .order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(rec => normalizePayment(rec, resolvedAddress!))

      // Set cursor refs unconditionally — they depend on Horizon's response,
      // not on whether this particular page happened to be non-empty.
      nextRef.current = () => res.next()
      prevRef.current = () => res.prev()

      return {
        payments: normalized,
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
    setPagePayments(null)
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
      const normalized = records.map(rec => normalizePayment(rec, resolvedAddress!))

      // Update cursor refs independently of record count so that landing on
      // an empty page never loses the ability to navigate back.
      nextRef.current = () => res.next()
      prevRef.current = () => res.prev()

      if (normalized.length > 0) {
        // Normal case: render the new page.
        setPagePayments(normalized)
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
  }, [resolvedAddress, limit])

  const fetchPrev = useCallback(async () => {
    if (!prevRef.current) return
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await prevRef.current()
      // Request limit+1 for prev too so hasPrev is symmetrically accurate.
      const hasPrev = res.records.length > limit
      const records = hasPrev ? res.records.slice(0, limit) : res.records
      const normalized = records.map(rec => normalizePayment(rec, resolvedAddress!))

      // Update cursor refs independently of record count.
      nextRef.current = () => res.next()
      prevRef.current = () => res.prev()

      if (normalized.length > 0) {
        setPagePayments(normalized)
      }
      setPageHasNext(true)
      setPageHasPrev(hasPrev)
    } catch (err) {
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [resolvedAddress, limit])

  const error = pageError ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageLoading || cacheLoading

  return {
    payments: pagePayments ?? data?.payments ?? [],
    loading,
    error,
    refetch,
    fetchNext,
    fetchPrev,
    hasNext: pageHasNext ?? data?.hasNext ?? false,
    hasPrev: pageHasPrev ?? data?.hasPrev ?? false,
  }
}

// ── Normalize Payment Operations ───────────────────────────────────────────
function normalizePayment(record: PaymentRecord, address: string): NormalizedPayment {
  const type = record.type
  const id = record.id
  const txHash = record.transaction_hash
  const createdAt = record.created_at

  let from = ""
  let to = ""
  let amount = "0"
  let asset: Asset = "XLM"
  let direction: "incoming" | "outgoing" = "outgoing"

  if (type === "payment") {
    from = record.from
    to = record.to
    amount = record.amount
    asset =
      record.asset_type === "native"
        ? "XLM"
        : { code: record.asset_code!, issuer: record.asset_issuer! }
    direction = to === address ? "incoming" : "outgoing"
  } else if (type === "create_account") {
    from = record.funder
    to = record.account
    amount = record.starting_balance
    asset = "XLM"
    direction = to === address ? "incoming" : "outgoing"
  } else if (type === "account_merge") {
    from = record.source_account
    to = record.into
    amount = "0"
    asset = "XLM"
    direction = to === address ? "incoming" : "outgoing"
  } else if (type === "path_payment_strict_receive" || type === "path_payment_strict_send") {
    from = record.from
    to = record.to
    direction = to === address ? "incoming" : "outgoing"

    if (direction === "incoming") {
      amount = record.amount
      asset =
        record.asset_type === "native"
          ? "XLM"
          : { code: record.asset_code!, issuer: record.asset_issuer! }
    } else {
      amount = record.source_amount || record.amount
      const srcAssetType = record.source_asset_type || record.asset_type
      asset =
        srcAssetType === "native"
          ? "XLM"
          : {
              code: record.source_asset_code || record.asset_code!,
              issuer: record.source_asset_issuer || record.asset_issuer!,
            }
    }
  }

  return { id, txHash, type, from, to, amount, asset, direction, createdAt }
}
