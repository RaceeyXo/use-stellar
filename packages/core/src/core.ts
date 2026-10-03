// Stellar React SDK - React-free Core Runtime Export
// ────────────────────────────────────────────────────────────────────────────
// This entry point provides framework-neutral runtime, cache, wallet-adapter,
// error, utility, and type APIs without loading React or React-specific
// declarations. Suitable for Vue adapters, server-side tools, and future
// framework implementations.

// ── Runtime & Cache ────────────────────────────────────────────────────────
export { QueryStore } from "./cache/store"
export { createQueryObserver } from "./cache/observer"
export type {
  QueryObserver,
  QueryObserverOptions,
  QueryObserverSnapshot,
  QueryObserverListener,
} from "./cache/observer"
export type { CacheEntry, CacheListener, QueryConfig } from "./cache/types"
export { DEFAULT_STALE_TIME, DEFAULT_GC_TIME } from "./cache/types"
export {
  accountKey,
  transactionKey,
  transactionHistoryKey,
  paymentsKey,
  paymentPathsKey,
  assetKey,
  claimableBalanceKey,
  federationKey,
  sorobanContractKey,
  tradesKey,
  serializeKey,
} from "./cache/keys"

// ── Wallet Adapter ─────────────────────────────────────────────────────────
export { freighterAdapter } from "./wallets/freighterAdapter"
export {
  FREIGHTER_WALLET_TYPE,
  NETWORK_PASSPHRASES,
  resolveNetworkFromPassphrase,
} from "./wallets/constants"
export {
  getWalletAdapter,
  getWalletAdapters,
  hasWalletAdapter,
  registerWalletAdapter,
} from "./wallets/registry"
export type { RegisterWalletAdapterOptions } from "./wallets/registry"
export { WalletAdapterError } from "./wallets/types"
export type {
  SignTransactionOptions,
  WalletAdapter,
  WalletAdapterErrorCode,
  WalletAdapterMetadata,
  WalletChange,
  WalletConnection,
  WalletNetworkDetails,
  WalletNetworkState,
} from "./wallets/types"

// ── Errors ─────────────────────────────────────────────────────────────────
export {
  STELLAR_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  isStellarErrorCode,
  type StellarErrorCode,
} from "./errors/codes"
export { StellarError, isStellarError, type StellarErrorOptions } from "./errors/StellarError"
export {
  createStellarError,
  toStellarError,
  toSubmissionError,
  isAbortError,
} from "./errors/factory"

// ── Utilities ──────────────────────────────────────────────────────────────
export { DEFAULT_FEE_MULTIPLIER } from "./utils/fees"
export {
  isBrowser,
  isValidAssetCode,
  isValidStellarAddress,
  shortenAddress,
  formatAmount,
  formatAssetCode,
  getNetworkConfig,
  getHorizonServer,
  isNativeAsset,
  isIssuedAsset,
  isLiquidityPoolShares,
  parseHorizonBalance,
} from "./utils/index"
export type { FeeSource } from "./utils/fees"
export { resolveFee, asFeeSource } from "./utils/fees"
export {
  isRetriable,
  getRetryAfterMs,
  getErrorStatus,
  computeBackoffDelay,
  sleep,
} from "./utils/retryWithBackoff"

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  StellarNetwork,
  NetworkConfig,
  CustomNetworkConfig,
  Asset,
  NativeAsset,
  IssuedAsset,
  Balance,
  AccountInfo,
  TransactionResult,
  TransactionStatus,
  WalletType,
  WalletNetworkId,
  WalletState,
  FeeOptions,
  FeeUrgency,
  ContractSpecLike,
  ContractEvent,
} from "./types"
export { NETWORK_CONFIGS, getNetworkPassphrase } from "./types"
export * from "./queries/account"
export * from "./queries/asset"
export * from "./queries/claimableBalance"
export * from "./queries/federation"
export * from "./queries/transaction"
