export {
  FREIGHTER_WALLET_TYPE,
  NETWORK_PASSPHRASES,
  resolveNetworkFromPassphrase,
} from "./constants"
export {
  getWalletAdapter,
  getWalletAdapters,
  hasWalletAdapter,
  registerWalletAdapter,
} from "./registry"
export type { RegisterWalletAdapterOptions } from "./registry"
export { createWalletConnectAdapter } from "./walletConnectAdapter"
export type { CreateWalletConnectAdapterOptions } from "./walletConnectAdapter"
// Browser wallet adapters are exported by the web entry (`index.ts`) only,
// so the React Native and React-free entries never pull them in.
export { WalletAdapterError } from "./types"
export type {
  SignTransactionOptions,
  WalletAdapter,
  WalletAdapterErrorCode,
  WalletAdapterMetadata,
  WalletChange,
  WalletConnection,
  WalletNetworkDetails,
  WalletNetworkState,
} from "./types"
