import type { Dispatch, SetStateAction } from "react"
import type { StellarError } from "../errors"

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
}

/**
 * Pre-defined configurations for supported Stellar networks.
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
 * Options for sending a payment transaction.
 */
export interface SendPaymentOptions {
  to: string
  asset: Asset
  amount: string
  memo?: string
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
}

export interface UsePaymentsReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
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