import type { Dispatch, SetStateAction } from "react"
import type { StellarError } from "../errors"
import type { QueryStore } from "../cache"
import type { xdr } from "@stellar/stellar-sdk"

export type { QueryConfig } from "../cache"

export type { StellarError, StellarErrorCode } from "../errors"
export type { AssetInfo, UseAssetOptions, UseAssetReturn } from "../hooks/useAsset"

/**
 * Represents the Stellar network environment.
 */
export type StellarNetwork = "testnet" | "mainnet"

/**
 * Configuration details for a specific Stellar network.
 */
export interface NetworkConfig {
  network: StellarNetwork
  horizonUrl: string
  sorobanUrl: string
}

export interface SorobanInvokeOptions {
  contractId: string
  method: string
  /** Explicit XDR arguments to prevent type mismatches on write paths */
  args?: xdr.ScVal[]
  /** Inclusion fee in stroops. The resource fee is derived from simulation automatically. */
  fee?: string
  /** Poll timeout in ms before giving up and surfacing TX_TIMEOUT (default 30000). */
  timeout?: number
}

export interface UseSorobanWriteReturn<T = unknown> {
  invoke: (options: SorobanInvokeOptions) => Promise<{ hash: string; result: T }>
  loading: boolean
  error: StellarError | null
  result: { hash: string; result: T } | null
  reset: () => void
}

/**
 * Partial override for custom Horizon / Soroban RPC endpoints.
 * Pass this to `StellarProvider` to bypass the built-in SDF defaults.
 *
 * @example
 * // Private infrastructure or rate-limit avoidance:
 * <StellarProvider
 *   network="mainnet"
 *   networkConfig={{
 *     horizonUrl: "https://horizon.my-node.com",
 *     sorobanUrl: "https://rpc.my-node.com",
 *   }}
 * />
 */
export interface CustomNetworkConfig {
  horizonUrl: string
  sorobanUrl: string
  networkPassphrase?: string
}

export interface UseSep10AuthOptions {
  /** Anchor home domain, e.g. `"testanchor.stellar.org"`. */
  homeDomain: string
  /** Defaults to the connected wallet address. */
  account?: string
  /** Optional muxed/memo sub-account, per SEP-10. */
  memo?: string
  /** Client domain for client attribution. Advanced; omit for most uses. */
  clientDomain?: string
  /**
   * Opt-in persistence. If true, the JWT is saved in localStorage.
   * NOTE: This exposes the credential to XSS attacks. Default is `false`.
   */
  persist?: boolean
}

export interface UseSep10AuthReturn {
  /** The JWT, or `null` when unauthenticated or expired. */
  token: string | null
  /** Decoded `exp` as a Date, so a caller can pre-emptively re-auth. */
  expiresAt: Date | null
  authenticated: boolean
  loading: boolean
  error: StellarError | null
  authenticate: () => Promise<string>
  logout: () => void
export interface NormalizedOffer {
  id: string
  seller: string
  selling: Asset
  buying: Asset
  amount: string
  priceR: { n: number; d: number }
  price: string
}

export interface UseOffersOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
}

export interface UseOffersReturn {
  offers: NormalizedOffer[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

export interface CreateOfferOptions extends FeeOptions {
  selling: Asset
  buying: Asset
  amount: string
  price: string | { n: number; d: number }
  /** Which operation to use. Defaults to "sell". */
  side?: "sell" | "buy"
}

export interface UpdateOfferOptions extends FeeOptions {
  selling: Asset
  buying: Asset
  amount: string
  price: string | { n: number; d: number }
  /** Which operation to use. Defaults to "sell". */
  side?: "sell" | "buy"
}

export interface UseManageOfferReturn {
  createOffer: (options: CreateOfferOptions) => Promise<TransactionResult>
  updateOffer: (offerId: string, options: UpdateOfferOptions) => Promise<TransactionResult>
  cancelOffer: (offerId: string, feeOptions?: FeeOptions) => Promise<TransactionResult>

export interface CreateAccountOptions extends FeeOptions {
  destination: string
  /** In XLM. Must meet the network's current base reserve. */
  startingBalance: string
}

export interface UseCreateAccountReturn {
  createAccount: (options: CreateAccountOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}

/**
 * The passphrase for each network this library ships defaults for.
 *
 * `custom` is deliberately absent — there is no such thing as a default
 * passphrase for a network we know nothing about.
 */
export const NETWORK_PASSPHRASES: Record<Exclude<StellarNetwork, "custom">, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
}

export interface UseFriendbotReturn {
  /** 
   * Funds the provided address via Friendbot. 
   * Defaults to the connected wallet address if omitted. 
   */
  fund: (address?: string) => Promise<void>
  loading: boolean
  error: StellarError | null
  funded: boolean
}

/**
 * Pre-defined configurations for supported Stellar networks.
 * The passphrase for a network, or `undefined` for `"custom"`.
 *
 * Use this rather than indexing {@link NETWORK_PASSPHRASES} directly: a custom
 * network genuinely has no known passphrase, and `undefined` says so instead
 * of handing back the wrong one.
 */
export function getNetworkPassphrase(network: StellarNetwork): string | undefined {
  return network === "custom" ? undefined : NETWORK_PASSPHRASES[network]
}

export interface OrderbookEntry {
  /** Exact price as a rational — use this for arithmetic. */
  priceR: { n: number; d: number }
  /** Precise decimal string derived from priceR. Display only. */
  price: string
  amount: string
}

export interface UseOrderbookOptions {
  selling: Asset
  buying: Asset
  limit?: number
  watch?: boolean
  interval?: number
  enabled?: boolean
}

export interface UseOrderbookReturn {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  /** null when either side is empty. */
  spread: string | null
  midPrice: string | null
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}

/**
 * Pre-defined configurations for the networks with published endpoints.
 *
 * `custom` has no entry: its endpoints and passphrase come from
 * `networkConfig`, and the provider throws if they are missing.
 */
export const NETWORK_CONFIGS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanUrl: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    network: "mainnet",
    horizonUrl: "https://horizon.stellar.org",
    sorobanUrl: "https://soroban.stellar.org",
  },
}

/**
 * Supported wallet providers.
 */
export type WalletType = "freighter" | "lobstr" | "albedo" | "rabet"

/**
 * The current state of the wallet connection.
 */
export interface WalletState {
  connected: boolean
  connecting: boolean
  address: string | null
  network: StellarNetwork | null // Network from provider config
  wallet: WalletType | null
  error: StellarError | null
  walletNetwork: StellarNetwork | null // Actual network from wallet extension
  walletName: string | null
}

/**
 * Represents the native Stellar asset (XLM).
 */
export type NativeAsset = "XLM"

/**
 * Represents a custom issued asset on the Stellar network.
 */
export interface IssuedAsset {
  code: string
  issuer: string
}

export interface LiquidityPoolAsset {
  asset: "liquidity_pool_shares"
  liquidityPoolId: string
}

/**
 * Extended asset information with validation metadata.
 */
export interface AssetMetadata extends IssuedAsset {
  verified: boolean
  timestamp: number
}

/**
 * Can be either a native asset, an issued asset, or liquidity pool shares.
 */
export type Asset = NativeAsset | IssuedAsset | "liquidity_pool_shares"

/**
 * Represents a Stellar AMM Liquidity Pool.
 */
export interface LiquidityPool {
  id: string
  fee_bp: number
  type: string
  total_trustlines: string
  total_shares: string
  reserves: { asset: string; amount: string }[]
}

/**
 * Represents a balance entry for an account.
 */
export type Balance =
  | {
      asset: "XLM"
      balance: string
    }
  | {
      asset: {
        code: string
        issuer: string
      }
      balance: string
      limit: string
    }
  | {
      asset: "liquidity_pool_shares"
      balance: string
      liquidityPoolId: string
    }

/**
 * Detailed account information from the Stellar network.
 */
export interface AccountInfo {
  address: string
  sequence: string
  balances: Balance[]
  subentryCount: number
  thresholds: {
    lowThreshold: number
    medThreshold: number
    highThreshold: number
  }
  signers: {
    key: string
    weight: number
    type: string
  }[]
}

/**
 * The current status of a transaction on the network.
 */
export type TransactionStatus = "pending" | "success" | "failed" | "not_found"

/**
 * Result details from a submitted or queried transaction.
 */
export interface TransactionResult {
  hash: string
  status: TransactionStatus
  ledger?: number
  createdAt?: string
  fee?: string
  envelope?: string
}

/**
 * Fee controls shared by every hook that builds a Horizon transaction.
 *
 * Stellar prices transactions by auction: each ledger has limited capacity,
 * and when more transactions are submitted than fit, the network takes the
 * highest bidders and rejects the rest with `tx_insufficient_fee`.
 *
 * **A fee is a maximum bid, not a charge.** The network only ever takes what
 * it needs to include your transaction, so bidding generously costs nothing in
 * the common case and is what keeps a transaction landing during congestion.
 */
export interface FeeOptions {
  /**
   * Explicit fee in stroops, per operation. Wins over everything else.
   *
   * @example
   * send({ to, asset: "XLM", amount: "10", fee: "10000" })
   */
  fee?: string
  /**
   * Multiplier applied to the network's current base fee, fetched from
   * Horizon at build time. Defaults to {@link DEFAULT_FEE_MULTIPLIER}.
   *
   * @example
   * send({ to, asset: "XLM", amount: "10", feeMultiplier: 10 })
   */
  feeMultiplier?: number
}

/**
 * A memo to attach to a payment. A bare string is treated as `MEMO_TEXT`.
 *
 * - `text`: <= 28 UTF-8 bytes
 * - `id`: unsigned 64-bit integer as a string; do not parse it to a JavaScript `number`
 * - `hash` / `return`: exactly 64 hexadecimal characters (32 bytes)
 */
export type MemoInput =
  | string
  | { type: "text"; value: string }
  | { type: "id"; value: string }
  | { type: "hash"; value: string }
  | { type: "return"; value: string }

/**
 * Options for sending a payment transaction.
 */
export interface SendPaymentOptions {
  to: string
  asset: Asset
  amount: string
  memo?: MemoInput
}

/**
 * Result returned after a payment is sent.
 */
export interface SendPaymentResult {
  hash: string
  status: TransactionStatus
}

/**
 * Options for adding a trustline to an asset.
 */
export interface AddTrustlineOptions {
  asset: IssuedAsset
  limit?: string
}

/**
 * Return value from the `useAddTrustline` hook.
 */
export interface UseAddTrustlineReturn {
  addTrustline: (options: AddTrustlineOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}

/**
 * A normalized payment record for display or processing.
 */
export interface NormalizedPayment {
  id: string
  txHash: string
  type: string
  from: string
  to: string
  amount: string
  asset: Asset
  direction: "incoming" | "outgoing"
  createdAt: string
}

/**
 * Options for calling a Soroban smart contract.
 */
export interface ContractCallOptions {
  contractId: string
  method: string
  args?: unknown[]
}

export interface ClaimableBalanceClaimant {
  destination: string
  predicate: object
}

export interface ClaimableBalance {
  id: string
  asset: string
  amount: string
  claimants: ClaimableBalanceClaimant[]
  sponsor?: string
}

/**
 * Context value provided by the StellarProvider.
 */
export interface StellarContextValue {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  setWallet: Dispatch<SetStateAction<WalletState>>
}

export interface UsePaymentsOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

export interface UsePaymentsReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
  /**
   * `true` when `error` is set but `payments` still holds data from a
   * previous successful fetch (stale-while-revalidate). `false` once a
   * fetch succeeds again, or when there is no data to be stale.
   */
  isStale: boolean
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Options for fetching an account's transaction history.
 */
export interface UseTransactionHistoryOptions {
  address?: string | null // defaults to the connected wallet
  limit?: number // default 10
  order?: "asc" | "desc" // default "desc"
  cursor?: string
}

/**
 * A normalized transaction record for display or processing.
 */
export interface NormalizedTransaction {
  hash: string
  ledger: number
  createdAt: string
  sourceAccount: string
  fee: string
  operationCount: number
  successful: boolean
  memo?: string
  memoType?: string
}

export interface UseTransactionHistoryReturn {
  transactions: NormalizedTransaction[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

export interface UsePaymentHistoryOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
  direction?: "incoming" | "outgoing" | "all"
  asset?: Asset | "all"
}

export interface UsePaymentHistoryReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

export interface FederationRecord {
  stellarAddress: string
  accountId: string
  memoType?: string
  memo?: string
}

export interface UseFederationLookupOptions {
  address?: string | null
}

export interface UseFederationLookupReturn {
  record: FederationRecord | null
  loading: boolean
  error: StellarError | null
  refetch: () => Promise<void>
}

export interface UseAccountExistsOptions {
  address?: string | null
}

export type AccountExistsReason = "exists" | "not_funded" | "invalid_format" | "idle"

export interface UseAccountExistsReturn {
  exists: boolean | null
  reason: AccountExistsReason
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

/**
 * Represents an open order on the SDEX.
 */
export interface Offer {
  id: string
  seller: string
  selling: Asset
  buying: Asset
  amount: string
  price: string
  price_r: { n: number; d: number }
  lastModifiedLedger: number
  lastModifiedTime: string
}

export interface UseOffersOptions {
  address?: string | null
  limit?: number
  cursor?: string
  order?: "asc" | "desc"
}

export interface UseOffersReturn {
  offers: Offer[]
  loading: boolean
  error: StellarError | null
  hasNext: boolean
  fetchNext: () => Promise<void>
  refetch: () => Promise<void>
}

export interface ManageOfferParams {
  selling: Asset
  buying: Asset
  amount: string
  price: string | { n: number; d: number }
  side?: "sell" | "buy"
}

export interface UseManageOfferReturn {
  createOffer: (o: ManageOfferParams) => Promise<TransactionResult | null>
  updateOffer: (offerId: string, o: ManageOfferParams) => Promise<TransactionResult | null>
  cancelOffer: (offerId: string) => Promise<TransactionResult | null>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
  refetch: () => void
}

// ── Trades ─────────────────────────────────────────────────────────────────

/**
 * A normalized executed trade (fill) from Horizon's `/trades` endpoint.
 *
 * **Base/counter orientation:** when filtering by asset pair, `baseAsset` is
 * always the asset you passed as `baseAsset` in the hook options, regardless
 * of which orientation Horizon chose. The price rational is inverted when the
 * pair is flipped. When no asset pair filter is provided, Horizon's canonical
 * ordering is used unchanged.
 */
export interface NormalizedTrade {
  /** Horizon trade ID. */
  id: string
  /** ISO-8601 timestamp of the ledger close that included this trade. */
  ledgerCloseTime: string
  /**
   * Whether this was an orderbook trade or a liquidity-pool trade.
   * Inspect this field if you need to filter by trade type.
   */
  tradeType: "orderbook" | "liquidity_pool"
  /** Base asset in the normalized orientation. */
  baseAsset: Asset
  /** Amount of the base asset exchanged. */
  baseAmount: string
  /** Counter asset in the normalized orientation. */
  counterAsset: Asset
  /** Amount of the counter asset exchanged. */
  counterAmount: string
  /**
   * Exact price as a rational number: `counterAmount / baseAmount`.
   * No float arithmetic is used to produce this value.
   */
  priceR: { n: number; d: number }
  /**
   * Precise decimal string of the price, computed from the rational with
   * integer arithmetic only (7 decimal places, trailing zeros stripped).
   * Use for display only — do not feed back into arithmetic.
   */
  price: string
  /**
   * Which side the queried account was on, present only when the hook is
   * filtering by account (`address` option). `"sell"` means the account
   * was selling the base asset; `"buy"` means it was buying the base asset.
   */
  side?: "buy" | "sell"
  /**
   * Raw Horizon `base_is_seller` flag. `true` means the base-side account
   * was the seller. Available in all filter modes.
   */
  baseIsSeller: boolean
}

/**
 * Options for `useTrades`.
 *
 * At least one of `address` or `baseAsset` must be provided; the hook returns
 * an empty list (and does not call Horizon) when neither is set.
 */
export interface UseTradesOptions {
  /**
   * Stellar account address. When provided, only trades involving this
   * account are returned. Also used to derive `side` on each trade.
   * Defaults to the connected wallet address if omitted.
   */
  address?: string | null
  /**
   * The asset you want on the base side of every returned trade.
   * Must be paired with `counterAsset`. Together they filter to a specific
   * orderbook and also define the normalized orientation rule.
   */
  baseAsset?: Asset | null
  /**
   * The asset you want on the counter side of every returned trade.
   * Must be paired with `baseAsset`.
   */
  counterAsset?: Asset | null
  /** Number of trades per page (default 10). */
  limit?: number
  /** Sort order (default `"desc"` — most recent first). */
  order?: "asc" | "desc"
}

/** Return value from `useTrades`. */
export interface UseTradesReturn {
  trades: NormalizedTrade[]
  loading: boolean
  error: StellarError | null
  /** `true` when a next page is available. */
  hasNext: boolean
  /** `true` when a previous page is available. */
  hasPrev: boolean
  /** Load the next page of trades. */
  fetchNext: () => Promise<void>
  /** Load the previous page of trades. */
  fetchPrev: () => Promise<void>
  /** Re-fetch the current page from Horizon. */
  refetch: () => void
}
