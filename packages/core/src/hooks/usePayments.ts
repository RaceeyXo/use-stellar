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
      const normalized = (
        await Promise.all(res.records.map(rec => normalizePayment(rec, resolvedAddress!, server)))
      ).flat()

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

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
      const server = getHorizonServer(networkConfig)
      const res = await nextRef.current()
      const normalized = (
        await Promise.all(res.records.map(rec => normalizePayment(rec, resolvedAddress!, server)))
      ).flat()
      setPagePayments(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(res.records.length >= limit)
      setPageHasPrev(true)
    } catch (err) {
      setPagePayments([])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [resolvedAddress, limit, networkConfig])

  const fetchPrev = useCallback(async () => {
    if (!prevRef.current) return
    setPageLoading(true)
    setPageError(null)
    try {
      const server = getHorizonServer(networkConfig)
      const res = await prevRef.current()
      const normalized = (
        await Promise.all(res.records.map(rec => normalizePayment(rec, resolvedAddress!, server)))
      ).flat()
      setPagePayments(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(true)
      setPageHasPrev(res.records.length >= limit)
    } catch (err) {
      setPagePayments([])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
  }, [resolvedAddress, limit, networkConfig])

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
async function normalizePayment(
  record: PaymentRecord,
  address: string,
  server: Horizon.Server
): Promise<NormalizedPayment[]> {
  const type = record.type
  const id = record.id
  const txHash = record.transaction_hash
  const createdAt = record.created_at

  if (
    type === "payment" ||
    type === "create_account" ||
    type === "path_payment_strict_receive" ||
    type === "path_payment_strict_send"
  ) {
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

    return [{ id, txHash, type, from, to, amount, asset, direction, createdAt }]
  }

  if (type === "account_merge") {
    const effects = await server.effects().forOperation(record.id).call()
    const mergeEffect = effects.records.find(
      eff =>
        (eff.type === "account_debited" || eff.type === "account_credited") &&
        "account" in eff &&
        eff.account === address
    )

    if (!mergeEffect || !("amount" in mergeEffect)) return []

    return [
      {
        id,
        txHash,
        type,
        from: record.account,
        to: record.into,
        amount: mergeEffect.amount,
        asset: "XLM",
        direction: record.into === address ? "incoming" : "outgoing",
        createdAt,
      },
    ]
  }

  if (type === "invoke_host_function") {
    const changes = record.asset_balance_changes ?? []

    return changes
      .filter(change => change.from === address || change.to === address)
      .map(change => ({
        id,
        txHash,
        type,
        from: change.from,
        to: change.to,
        amount: change.amount,
        asset:
          change.asset_type === "native"
            ? "XLM"
            : { code: change.asset_code!, issuer: change.asset_issuer! },
        direction: change.to === address ? "incoming" : "outgoing",
        createdAt,
      }))
  }

  // Unhandled operation type: filter it out rather than fabricating a payment.
  return []
}
