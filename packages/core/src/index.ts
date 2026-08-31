// Stellar React SDK - Main entry point
// ── Provider ───────────────────────────────────────────────────────────────
export { StellarProvider, WALLET_SESSION_STORAGE_KEY } from "./context/StellarProvider"
export type { StellarProviderProps, QueryConfig } from "./context/StellarProvider"

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useWallet } from "./hooks/useWallet"
export type { UseWalletReturn } from "./hooks/useWallet"
export { useBalance } from "./hooks/useBalance"
export type { UseBalanceOptions, UseBalanceReturn } from "./hooks/useBalance"
export { useAccount } from "./hooks/useAccount"
export type { UseAccountOptions, UseAccountReturn } from "./hooks/useAccount"
export { useAccountExists } from "./hooks/useAccountExists"
export { useSendPayment } from "./hooks/useSendPayment"
export type { UseSendPaymentReturn } from "./hooks/useSendPayment"
export { useAddTrustline } from "./hooks/useAddTrustline"
export { useTransaction } from "./hooks/useTransaction"
export type { UseTransactionOptions, UseTransactionReturn } from "./hooks/useTransaction"
export { useNetwork } from "./hooks/useNetwork"
export type { UseNetworkReturn } from "./hooks/useNetwork"
export { useAsset } from "./hooks/useAsset"
export type { AssetInfo, UseAssetOptions, UseAssetReturn } from "./hooks/useAsset"
export { useFederationLookup } from "./hooks/useFederationLookup"
export type {
  FederationRecord,
  UseFederationLookupOptions,
  UseFederationLookupReturn,
} from "./types"
export { useSorobanContract, ANONYMOUS_SIMULATION_SOURCE } from "./hooks/useSorobanContract"
export type { UseSorobanContractReturn } from "./hooks/useSorobanContract"
export { usePaymentPaths } from "./hooks/usePaymentPaths"
export { useContractEvents } from "./hooks/useContractEvents"
export { usePathPayment } from "./hooks/usePathPayment"
export { usePayments } from "./hooks/usePayments"
export { useTransactionHistory } from "./hooks/useTransactionHistory"
export { usePaymentHistory } from "./hooks/usePaymentHistory"
export { useClaimableBalance } from "./hooks/useClaimableBalance"
export type {
  UseClaimableBalanceOptions,
  UseClaimableBalanceReturn,
} from "./hooks/useClaimableBalance"
export { useAnchor } from "./hooks/useAnchor"
export type { AnchorInfo, AnchorCurrency, UseAnchorOptions, UseAnchorReturn } from "./types"
export { useTrades } from "./hooks/useTrades"
// ...
export * from "./hooks/useSep10Auth"
export type { UseSep10AuthOptions, UseSep10AuthReturn } from "./types"
// packages/core/src/index.ts

// ...
export * from "./hooks/useOffers"
export * from "./hooks/useManageOffer"
export type { UseOffersOptions, UseOffersReturn, NormalizedOffer, UseManageOfferReturn, CreateOfferOptions, UpdateOfferOptions } from "./types"
export * from "./hooks/useCreateAccount"
export type { CreateAccountOptions, UseCreateAccountReturn } from "./types"


export * from "./hooks/useOrderbook"
export type { OrderbookEntry, UseOrderbookOptions, UseOrderbookReturn } from "./types"
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
} from "./wallets"

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
} from "./errors"
export type { StellarErrorCode, StellarErrorOptions } from "./errors"

// ── Utilities ────────────────────────────────────────────────────────────
export { DEFAULT_FEE_MULTIPLIER } from "./utils/fees"
export { NETWORK_CONFIGS, getNetworkPassphrase } from "./types"
export {
  isBrowser,
  isValidAssetCode,
  isValidStellarAddress,
  shortenAddress,
  formatAmount,
  formatAssetCode,
} from "./utils"

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  StellarNetwork,
  NetworkConfig,
  CustomNetworkConfig,
  AutoConnectOptions,
  WalletType,
  WalletNetworkId,
  WalletState,
  Asset,
  NativeAsset,
  IssuedAsset,
  Balance,
  AccountInfo,
  TransactionResult,
  TransactionStatus,
  SendPaymentOptions,
  SendPaymentResult,
  UseAddTrustlineReturn,
  AddTrustlineOptions,
  NormalizedPayment,
  ContractCallOptions,
  ContractSpecLike,
  ContractEvent,
  UseContractEventsOptions,
  UseContractEventsReturn,
  FeeOptions,
  PaymentPath,
  UsePaymentPathsOptions,
  UsePaymentPathsReturn,
  PathPaymentOptions,
  UsePathPaymentReturn,
  StellarContextValue,
  UsePaymentsOptions,
  UsePaymentsReturn,
  UseTransactionHistoryOptions,
  UseTransactionHistoryReturn,
  NormalizedTransaction,
  UsePaymentHistoryOptions,
  UsePaymentHistoryReturn,
  ClaimableBalance,
  ClaimableBalanceClaimant,
  UseAccountExistsOptions,
  UseAccountExistsReturn,
  AccountExistsReason,
  NormalizedTrade,
  UseTradesOptions,
  UseTradesReturn,
} from "./types"
export type {
  RegisterWalletAdapterOptions,
  SignTransactionOptions,
  WalletAdapter,
  WalletAdapterErrorCode,
  WalletAdapterMetadata,
  WalletChange,
  WalletConnection,
  WalletNetworkDetails,
  WalletNetworkState,
} from "./wallets"
