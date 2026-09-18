// packages/core/src/hooks/usePayments.ts

import { useCallback, useReducer, useRef } from "react"
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

interface PaginationState {
  queryKey: string
  payments: NormalizedPayment[] | null
  next: (() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null
  prev: (() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null
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
      payments: NormalizedPayment[]
      next: (() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null
      prev: (() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null
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
        payments: null,
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
        payments:
          action.keepCurrentWhenEmpty && action.payments.length === 0
            ? state.payments
            : action.payments,
        next: action.next,
        prev: action.prev,
        hasNext: action.hasNext,
        hasPrev: action.hasPrev,
      }
    case "FETCH_ERROR":
      if (state.queryKey !== action.queryKey) return state
      return { ...state, loading: false, error: action.error, payments: [] }
    default:
      return state
  }
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
  maxRetries,
}: UsePaymentsOptions = {}): UsePaymentsReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKeyArr = resolvedAddress
    ? paymentsKey(networkConfig.horizonUrl, network, resolvedAddress, limit, order, cursor)
    : (["payments", "disabled"] as const)
  const currentQueryKey = JSON.stringify(queryKeyArr)

  // Monotonic request id. A page navigation captures it at the start and
  // discards its own response if a newer navigation or refetch has since
  // claimed the display — the reducer's queryKey check cannot catch this,
  // because a refetch does not change the key.
  const requestRef = useRef(0)

  const [pageState, dispatch] = useReducer(paginationReducer, {
    queryKey: currentQueryKey,
    payments: null,
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
        .payments()
        .forAccount(requestAddress)
        .limit(limit + 1)
        .order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(rec => normalizePayment(rec, requestAddress))

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        payments: normalized,
        // Cursor callbacks are set from Horizon's response regardless of record
        // count, so landing on an empty page never loses the way back.
        next: () => res.next(),
        prev: () => res.prev(),
        hasNext,
        hasPrev: !!cursor,
      })

      return {
        payments: normalized,
        hasNext,
        hasPrev: !!cursor,
      }
    },
    store: queryStore,
    enabled: Boolean(resolvedAddress),
    maxRetries,
  })

  const fetchNext = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.next) return

    const fetchId = ++requestRef.current
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.next()
      const requestAddress = resolvedAddress
      if (!requestAddress) return

      const hasNext = res.records.length > limit
      const records = hasNext ? res.records.slice(0, limit) : res.records
      const normalized = records.map(rec => normalizePayment(rec, requestAddress))

      if (fetchId !== requestRef.current) return

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        payments: normalized,
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
  }, [pageState, currentQueryKey, resolvedAddress, limit])

  const fetchPrev = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.prev) return

    const fetchId = ++requestRef.current
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.prev()
      const requestAddress = resolvedAddress
      if (!requestAddress) return

      const hasPrev = res.records.length > limit
      const records = hasPrev ? res.records.slice(0, limit) : res.records
      const normalized = records.map(rec => normalizePayment(rec, requestAddress))

      if (fetchId !== requestRef.current) return

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        payments: normalized,
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
  }, [pageState, currentQueryKey, resolvedAddress, limit])

  /** Drops any page navigation and supersedes in-flight page fetches. */
  const refetchLatest = useCallback(() => {
    requestRef.current += 1
    dispatch({ type: "RESET", queryKey: currentQueryKey })
    refetch()
  }, [currentQueryKey, refetch])

  const error = pageState.error ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageState.loading || cacheLoading
  const payments = pageState.payments ?? data?.payments ?? []

  // Stale-while-revalidate: `payments` still holds the previous good page while
  // `error` is set, so a consumer can tell "old data" from "no data".
  const isStale = error !== null && payments.length > 0

  return {
    payments,
    loading,
    error,
    isStale,
    refetch: refetchLatest,
    fetchNext,
    fetchPrev,
    hasNext: pageState.hasNext ?? data?.hasNext ?? false,
    hasPrev: pageState.hasPrev ?? data?.hasPrev ?? false,
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
        : { code: record.asset_code || "", issuer: record.asset_issuer || "" }
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
          : { code: record.asset_code || "", issuer: record.asset_issuer || "" }
    } else {
      amount = record.source_amount || record.amount
      const srcAssetType = record.source_asset_type || record.asset_type
      asset =
        srcAssetType === "native"
          ? "XLM"
          : {
              code: record.source_asset_code || record.asset_code || "",
              issuer: record.source_asset_issuer || record.asset_issuer || "",
            }
    }
  }

  return { id, txHash, type, from, to, amount, asset, direction, createdAt }
}
