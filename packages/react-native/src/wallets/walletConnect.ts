import type { WalletAdapter } from "use-stellar"
import { createWalletConnectAdapter, WalletAdapterError } from "use-stellar"
import type { Storage } from "../platform/asyncStorageSession"

/** Options required to enable WalletConnect in a native application. */
export interface ReactNativeWalletConnectOptions {
  /** WalletConnect Cloud project ID belonging to the application. */
  projectId: string
  metadata: {
    name: string
    description: string
    url: string
    icons: string[]
  }
  /** Optional WalletConnect key/value storage implementation. */
  storage?: Storage
  /** Called when a pairing URI is available, for QR fallback display. */
  onPairingUri?: (uri: string) => void
  /** Open the pairing URI using an app-specific universal/deep link. */
  openWallet?: (uri: string) => void | Promise<void>
}

/**
 * Creates the React Native integration around the transport-agnostic core
 * adapter. Call only when configured so native WalletConnect modules remain
 * optional and are never loaded in applications that do not use the feature.
 */
export function createReactNativeWalletConnectAdapter(
  options: ReactNativeWalletConnectOptions
): WalletAdapter {
  if (!options.projectId?.trim()) {
    throw new WalletAdapterError(
      "wallet_unavailable",
      "WalletConnect requires an application projectId."
    )
  }

  // This must run before SignClient is dynamically imported by the core adapter.
  // eslint-disable-next-line global-require
  require("@walletconnect/react-native-compat")

  const adapter = createWalletConnectAdapter({
    projectId: options.projectId,
    metadata: options.metadata,
    storage: options.storage,
    onDisplayUri: uri => {
      options.onPairingUri?.(uri)
      if (options.openWallet) {
        void options.openWallet(uri)
        return
      }

      try {
        // Resolve React Native only when pairing starts, keeping native modules
        // out of applications that never configure WalletConnect.
        // eslint-disable-next-line global-require
        const { Linking } = require("react-native") as {
          Linking: { openURL: (url: string) => Promise<unknown> }
        }
        void Linking.openURL(uri).catch(() => undefined)
      } catch {
        // QR fallback remains available through onPairingUri.
      }
    },
  })

  return {
    ...adapter,
    async connect(network) {
      assertSupportedNetwork(network)
      return adapter.connect(network)
    },
    async getNetworkDetails(network) {
      assertSupportedNetwork(network)
      return adapter.getNetworkDetails(network)
    },
    async signTransaction(xdr, signOptions) {
      assertSupportedPassphrase(signOptions.networkPassphrase)
      return adapter.signTransaction(xdr, signOptions)
    },
  }
}

function assertSupportedNetwork(network: string): asserts network is "testnet" | "mainnet" {
  if (network !== "testnet" && network !== "mainnet") {
    throw new WalletAdapterError(
      "wallet_network_mismatch",
      `WalletConnect Stellar wallets cannot sign the ${network} network.`
    )
  }
}

function assertSupportedPassphrase(passphrase: string): void {
  const testnet = "Test SDF Network ; September 2015"
  const mainnet = "Public Global Stellar Network ; September 2015"
  if (passphrase !== testnet && passphrase !== mainnet) {
    throw new WalletAdapterError(
      "wallet_network_mismatch",
      "WalletConnect Stellar wallets cannot sign custom or unsupported networks."
    )
  }
}
