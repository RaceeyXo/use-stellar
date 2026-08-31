/**
 * Query key builders for every fetching hook.
 *
 * A key must include every dimension that changes the result:
 * - The resolved horizonUrl (not just network name, so a custom private node
 *   is never conflated with the public SDF endpoint).
 * - The network name (belt-and-suspenders; the URL alone is sufficient but the
 *   name makes keys readable in DevTools / logs).
 * - Every caller-controlled parameter (address, limit, order, cursor, etc.).
 *
 * Keys are plain JavaScript arrays. They are serialised to a string by the
 * store, but the array form is used here so each segment is visible and
 * diff-able in tests.
 */

// ── Horizon-backed hooks ────────────────────────────────────────────────────

/** useBalance, useAccount, useAccountExists — all call server.loadAccount */
export function accountKey(
  horizonUrl: string,
  network: string,
  address: string
): readonly unknown[] {
  return ["account", horizonUrl, network, address] as const
}

/** useTransaction */
export function transactionKey(
  horizonUrl: string,
  network: string,
  hash: string
): readonly unknown[] {
  return ["transaction", horizonUrl, network, hash] as const
}

/** useTransactionHistory */
export function transactionHistoryKey(
  horizonUrl: string,
  network: string,
  address: string,
  limit: number,
  order: string,
  cursor: string | undefined
): readonly unknown[] {
  return ["transactionHistory", horizonUrl, network, address, limit, order, cursor ?? ""] as const
}

/** usePayments */
export function paymentsKey(
  horizonUrl: string,
  network: string,
  address: string,
  limit: number,
  order: string,
  cursor: string | undefined
): readonly unknown[] {
  return ["payments", horizonUrl, network, address, limit, order, cursor ?? ""] as const
}

/** usePaymentPaths */
export function paymentPathsKey(
  horizonUrl: string,
  network: string,
  mode: string,
  sourceAsset: string,
  destinationAsset: string,
  amount: string,
  addressFilter: string | undefined
): readonly unknown[] {
  return [
    "paymentPaths",
    horizonUrl,
    network,
    mode,
    sourceAsset,
    destinationAsset,
    amount,
    addressFilter ?? "",
  ] as const
}

/** useAsset */
export function assetKey(
  horizonUrl: string,
  network: string,
  code: string,
  issuer: string
): readonly unknown[] {
  return ["asset", horizonUrl, network, code, issuer] as const
}

/** useClaimableBalance */
export function claimableBalanceKey(
  horizonUrl: string,
  network: string,
  address: string
): readonly unknown[] {
  return ["claimableBalance", horizonUrl, network, address] as const
}

/** useFederationLookup — no Horizon URL, goes through federation server */
export function federationKey(address: string): readonly unknown[] {
  return ["federation", address] as const
}

/** useTrades */
export function tradesKey(
  horizonUrl: string,
  network: string,
  address: string,
  baseAsset: string,
  counterAsset: string,
  limit: number,
  order: string
): readonly unknown[] {
  return ["trades", horizonUrl, network, address, baseAsset, counterAsset, limit, order] as const
}

/** useSorobanContract */
export function sorobanContractKey(
  sorobanUrl: string,
  network: string,
  contractId: string,
  method: string,
  argsKey: string,
  source: string
): readonly unknown[] {
  return ["sorobanContract", sorobanUrl, network, contractId, method, argsKey, source] as const
}

// ── Serialisation ────────────────────────────────────────────────────────────

/**
 * Serialise a query key array to a stable string for use as a Map key.
 *
 * `JSON.stringify` covers all the primitives we put in these arrays.
 */
export function serializeKey(key: readonly unknown[]): string {
  return JSON.stringify(key)
}
