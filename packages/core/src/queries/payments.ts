import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import type { Asset, NetworkConfig, NormalizedPayment } from "../types"
import type { Horizon } from "@stellar/stellar-sdk"
import { splitOverfetchedPage } from "./pagination"

export type PaymentRecord =
  | Horizon.ServerApi.PaymentOperationRecord
  | Horizon.ServerApi.CreateAccountOperationRecord
  | Horizon.ServerApi.AccountMergeOperationRecord
  | Horizon.ServerApi.PathPaymentOperationRecord
  | Horizon.ServerApi.PathPaymentStrictSendOperationRecord
  | Horizon.ServerApi.InvokeHostFunctionOperationRecord

export interface FetchPaymentsPageParams {
  address: string
  limit: number
  order: "asc" | "desc"
  cursor?: string
}

export interface PaymentsPageResult {
  records: NormalizedPayment[]
  nextCursor: () => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>
  prevCursor: () => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Fetches one page of an account's payment operations from Horizon,
 * normalizing records and deriving pagination state.
 *
 * Framework-neutral: no React/Vue imports, no cache access. Errors are mapped
 * through `toStellarError` so both frameworks surface identical codes.
 */
export async function fetchPaymentsPage(
  networkConfig: NetworkConfig,
  params: FetchPaymentsPageParams,
  options: { signal?: AbortSignal } = {}
): Promise<PaymentsPageResult> {
  const { address, limit, order, cursor } = params
  try {
    const server = getHorizonServer(networkConfig)
    // Ask for one more than requested: see splitOverfetchedPage.
    let query = server
      .payments()
      .forAccount(address)
      .limit(limit + 1)
      .order(order)
    if (cursor) query = query.cursor(cursor)

    const res = await query.call()
    const { records, hasNext, hasPrev } = splitOverfetchedPage(res.records, limit, !!cursor)
    const normalized = records.map(rec => normalizePayment(rec, address))

    return {
      records: normalized,
      nextCursor: () => res.next(),
      prevCursor: () => res.prev(),
      hasNext,
      hasPrev,
    }
  } catch (err) {
    if (options.signal?.aborted) throw err
    const stellarError = toStellarError(err)
    throw stellarError ?? err
  }
}

/** Converts a raw Horizon operation record into a `NormalizedPayment`. */
export function normalizePayment(record: PaymentRecord, address: string): NormalizedPayment {
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

export interface PaymentFilter {
  direction?: "incoming" | "outgoing" | "all"
  asset?: Asset | "all"
}

function isIssuedAssetFilter(asset: Asset | "all"): asset is { code: string; issuer: string } {
  return typeof asset === "object" && asset !== null
}

/**
 * Pure predicate-based filter shared by `usePaymentHistory` across
 * frameworks. Matches a normalized payment against a direction and/or asset
 * filter.
 */
export function filterPayments(
  payments: NormalizedPayment[],
  filter: PaymentFilter
): NormalizedPayment[] {
  const direction = filter.direction ?? "all"
  const asset = filter.asset ?? "all"

  return payments.filter(p => {
    if (direction !== "all" && p.direction !== direction) return false

    if (isIssuedAssetFilter(asset)) {
      if (p.asset === "XLM") return false
      if (typeof p.asset === "object" && p.asset !== null) {
        if (p.asset.code !== asset.code || p.asset.issuer !== asset.issuer) return false
      } else {
        return false
      }
    } else if (asset !== "all" && p.asset !== asset) {
      return false
    }

    return true
  })
}
