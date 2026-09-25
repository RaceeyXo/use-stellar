/**
 * @use-stellar/react-native
 *
 * React Native StellarProvider with native platform integrations for AppState,
 * NetInfo, and AsyncStorage. Re-exports all core hooks and types.
 */

// Provider
export { StellarProvider } from "./StellarProvider"
export type { NativeStellarProviderProps } from "./StellarProvider"

// Platform integrations
export { createAppStateFocusManager, createAlwaysFocusedManager } from "./platform/appStateFocus"
export type { FocusManager } from "./platform/appStateFocus"

export { createNetInfoOnlineManager, createAlwaysOnlineManager } from "./platform/netInfoOnline"
export type { OnlineManager } from "./platform/netInfoOnline"

export { createAsyncStorageAdapter, createInMemoryStorage } from "./platform/asyncStorageSession"
export type { Storage } from "./platform/asyncStorageSession"

// Re-export all core hooks and types
export {
  // Provider
  useStellarContext,
  WALLET_SESSION_STORAGE_KEY,
  // Hooks
  useWallet,
  useBalance,
  useAccount,
  useAccountExists,
  useSendPayment,
  useAddTrustline,
  useTransaction,
  useNetwork,
  useAsset,
  useFederationLookup,
  useSorobanContract,
  useSorobanWrite,
  usePaymentPaths,
  useContractEvents,
  usePathPayment,
  usePayments,
  useTransactionHistory,
  usePaymentHistory,
  useClaimableBalance,
  useFeeStats,
  useAnchor,
  useTrades,
  useSep10Auth,
  // Utilities
  registerWalletAdapter,
  getWalletAdapter,
  getWalletAdapters,
  hasWalletAdapter,
} from "@use-stellar/core"

export type {
  // Types
  StellarNetwork,
  NetworkConfig,
  CustomNetworkConfig,
  StellarContextValue,
  WalletState,
  AutoConnectOptions,
  QueryConfig,
  // Wallet types
  WalletType,
  WalletNetworkId,
  // Error types
  StellarError,
  StellarErrorCode,
  // Hook return types
  UseWalletReturn,
  UseBalanceOptions,
  UseBalanceReturn,
  UseAccountOptions,
  UseAccountReturn,
  UseSendPaymentReturn,
  UseTransactionOptions,
  UseTransactionReturn,
  UseNetworkReturn,
  AssetInfo,
  UseAssetOptions,
  UseAssetReturn,
  FederationRecord,
  UseFederationLookupOptions,
  UseFederationLookupReturn,
  UseSorobanContractReturn,
  SorobanInvokeOptions,
  UseSorobanWriteReturn,
  UseClaimableBalanceOptions,
  UseClaimableBalanceReturn,
  AnchorInfo,
  AnchorCurrency,
  UseAnchorOptions,
  UseAnchorReturn,
  UseSep10AuthOptions,
  UseSep10AuthReturn,
} from "@use-stellar/core"
