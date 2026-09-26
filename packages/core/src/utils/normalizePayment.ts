// packages/core/src/utils/normalizePayment.ts
//
// Shared by usePayments (history) and useStreamPayments (live tail) so both
// surfaces normalize a Horizon payment-shaped operation record identically —
// including the Soroban invoke_host_function payments neither hook can afford
// to render as a blank row.

import type { Horizon } from "@stellar/stellar-sdk"
import type { Asset, NormalizedPayment } from "../types"

export type PaymentRecord =
  | Horizon.ServerApi.PaymentOperationRecord
  | Horizon.ServerApi.CreateAccountOperationRecord
  | Horizon.ServerApi.AccountMergeOperationRecord
  | Horizon.ServerApi.PathPaymentOperationRecord
  | Horizon.ServerApi.PathPaymentStrictSendOperationRecord
  | Horizon.ServerApi.InvokeHostFunctionOperationRecord

/**
 * Normalizes a Horizon payment-shaped operation record — `payment`,
 * `create_account`, `account_merge`, either path-payment variant, or a
 * Soroban `invoke_host_function` — into a {@link NormalizedPayment}.
 *
 * `address` decides `direction`: records where `address` is the recipient are
 * `"incoming"`, everything else is `"outgoing"`.
 */
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
