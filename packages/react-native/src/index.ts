// Stellar React Native SDK - Main entry point
// Re-exports all public APIs from use-stellar for React Native apps.
// NOTE: Does NOT import polyfills. Apps must explicitly import:
//   import '@use-stellar/react-native/polyfills'

// ── Provider ───────────────────────────────────────────────────────────────
export { StellarProvider, WALLET_SESSION_STORAGE_KEY } from "use-stellar"
export type { StellarProviderProps, QueryConfig } from "use-stellar"

// ── Hooks ──────────────────────────────────────────────────────────────────
export * from "use-stellar"
export type { SorobanInvokeOptions, UseSorobanWriteReturn } from "use-stellar"
export { useWallet } from "use-stellar"
export type { UseWalletReturn } from "use-stellar"
export { useBalance } from "use-stellar"
export type { UseBalanceOptions, UseBalanceReturn } from "use-stellar"
export { useAccount } from "use-stellar"
export type { UseAccountOptions, UseAccountReturn } from "use-stellar"
export { useAccountExists } from "use-stellar"
export { useSendPayment } from "use-stellar"
export type { UseSendPaymentReturn } from "use-stellar"
export { useAddTrustline } from "use-stellar"
export { useTransaction } from "use-stellar"
export type { UseTransactionOptions, UseTransactionReturn } from "use-stellar"
export { useNetwork } from "use-stellar"
export type { UseNetworkReturn } from "use-stellar"
export { useAsset } from "use-stellar"
export type { AssetInfo, UseAssetOptions, UseAssetReturn } from "use-stellar"
export { useFederationLookup } from "use-stellar"
export type { FederationRecord, UseFederationLookupOptions, UseFederationLookupReturn } from "use-stellar"
export { useSorobanContract, ANONYMOUS_SIMULATION_SOURCE } from "use-stellar"
export type { UseSorobanContractReturn } from "use-stellar"
export { usePaymentPaths } from "use-stellar"
export { useContractEvents } from "use-stellar"
export { usePathPayment } from "use-stellar"
export { usePayments } from "use-stellar"
export { useTransactionHistory } from "use-stellar"
export { usePaymentHistory } from "use-stellar"
export { useClaimableBalance } from "use-stellar"
export type { UseClaimableBalanceOptions, UseClaimableBalanceReturn } from "use-stellar"
export { useFeeStats } from "use-stellar"
export { useAnchor } from "use-stellar"
export type { AnchorInfo, AnchorCurrency, UseAnchorOptions, UseAnchorReturn } from "use-stellar"
export { useTrades } from "use-stellar"
export { useOffers } from "use-stellar"
export { useManagerOffer } from "use-stellar"
export { useCreateAccount } from "use-stellar"
export { useOrderBook } from "use-stellar"
export * from "use-stellar"
export type { UseSep10AuthOptions, UseSep10AuthReturn } from "use-stellar"

// ── Wallets ────────────────────────────────────────────────────────────────
export {
  FREIGHTER_WALLET_TYPE,
  NETWORK_PASSPHRASES,
  WalletAdapterError,
  freighterAdapter,
  getWalletAdapter,
  getWalletAdapters,
  hasWalletAdapter,
  registerWalletAdapter,
  resolveNetworkFromPassphrase,
} from "use-stellar"

// ── Errors ─────────────────────────────────────────────────────────────────
export {
  StellarError,
  createStellarError,
  toStellarError,
  isStellarError,
  isStellarErrorCode,
  isAbortError,
  STELLAR_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
} from "use-stellar"

// ── Utils ──────────────────────────────────────────────────────────────────
export {
  isBrowser,
  isValidAssetCode,
  isValidStellarAddress,
  shortenAddress,
  formatAmount,
  formatAssetCode,
  DEFAULT_FEE_MULTIPLIER,
  NETWORK_CONFIGS,
  getNetworkPassphrase,
} from "use-stellar"

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  StellarNetwork,
  NetworkConfig,
  CustomNetworkConfig,
  AutoConnectOptions,
  WalletType,
  WalletState,
  Asset,
  Balance,
  AccountInfo,
  TransactionResult,
} from "use-stellar"
