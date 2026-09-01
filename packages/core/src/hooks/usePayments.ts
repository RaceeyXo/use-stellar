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

  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)

  // Monotonic id shared by fetchPayments/fetchNext/fetchPrev — whichever of
  // the three started most recently owns the state writes below, so a
  // slower, superseded response (from any of the three) is discarded.
  // Distinct from unmount cancellation below — a superseded fetch is
  // discarded because a newer fetch owns the state, while a cancelled fetch
  // is discarded because there is no component left to update.
  const requestRef = useRef(0)
  // Set only by the effect cleanup on unmount. Reset at the top of the
  // effect so it doesn't leak across re-runs.
  const cancelledRef = useRef(false)

  const fetchPayments = useCallback(async () => {
    if (!resolvedAddress) {
      setPayments([])
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
      let query = server.payments().forAccount(resolvedAddress).limit(limit).order(order)
      if (cursor) {
        query = query.cursor(cursor)
      }

      const res = await query.call()

      if (cancelledRef.current || fetchId !== requestRef.current) return

      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress))
      setPayments(normalized)
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
      let query = server.payments().forAccount(resolvedAddress!).limit(limit).order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress!))

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setHasNext(res.records.length >= limit)
      setHasPrev(!!cursor)
    } catch (err) {
      if (cancelledRef.current || fetchId !== requestRef.current) return
      setPayments([])
      // Stale-while-revalidate: a failed fetch keeps the last known-good
      // payments in place and only surfaces the error.
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
        payments: normalized,
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

      if (cancelledRef.current || fetchId !== requestRef.current) return

      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress!))
      setPagePayments(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(res.records.length >= limit)
      setPageHasPrev(true)
    } catch (err) {
      if (cancelledRef.current || fetchId !== requestRef.current) return
      setPayments([])
      // Stale-while-revalidate: a failed fetch keeps the last known-good
      // payments in place and only surfaces the error.
      setError(toStellarError(err))
    } finally {
      if (!cancelledRef.current && fetchId === requestRef.current) {
        setLoading(false)
      }
      setPagePayments([])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [resolvedAddress, limit])

  const fetchPrev = useCallback(async () => {
    if (!prevRef.current) return
    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await prevRef.current()

      if (cancelledRef.current || fetchId !== requestRef.current) return

      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress!))
      setPagePayments(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(true)
      setPageHasPrev(res.records.length >= limit)
    } catch (err) {
      if (cancelledRef.current || fetchId !== requestRef.current) return
      setPayments([])
      // Stale-while-revalidate: a failed fetch keeps the last known-good
      // payments in place and only surfaces the error.
      setError(toStellarError(err))
    } finally {
      if (!cancelledRef.current && fetchId === requestRef.current) {
        setLoading(false)
      }
    }
  }, [resolvedAddress, limit])

  // Clear stale data synchronously the moment the query changes (address or
  // network), before the new fetch resolves — otherwise there's a window
  // where the previous account's payments render under the new query.
  // Refetches (including fetchNext/fetchPrev) must NOT hit this: they keep
  // the old data in place until the new fetch settles, per
  // stale-while-revalidate.
  useEffect(() => {
    setPayments([])
    setHasNext(false)
    setHasPrev(false)
    setError(null)
  }, [resolvedAddress, network])

  useEffect(() => {
    cancelledRef.current = false
    fetchPayments()
    return () => {
      cancelledRef.current = true
    }
  }, [fetchPayments])
      setPagePayments([])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [resolvedAddress, limit])

  const error = pageError ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageLoading || cacheLoading

  const isStale = error !== null && payments.length > 0

  return {
    payments: pagePayments ?? data?.payments ?? [],
    loading,
    error,
    isStale,
    refetch: fetchPayments,
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
