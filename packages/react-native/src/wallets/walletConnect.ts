import { Linking } from "react-native"
import type { WalletAdapter } from "use-stellar"
import type { LobstrAdapterOptions } from "use-stellar"
import { configureLobstrAdapter, createWalletConnectAdapter, WalletAdapterError } from "use-stellar"

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
  /**
   * Optional WalletConnect key/value storage (`IKeyValueStorage` from
   * `@walletconnect/keyvaluestorage`). Leave unset to use the AsyncStorage
   * backend `@walletconnect/react-native-compat` installs.
   *
   * This is not the provider's `storage` prop: WalletConnect stores structured
   * values and enumerates its keys, which a plain `getItem` / `setItem` adapter
   * cannot do.
   */
  storage?: unknown
  /** Called when a pairing URI is available, for QR fallback display. */
  onPairingUri?: (uri: string) => void
  /** Open the pairing URI using an app-specific universal/deep link. */
  openWallet?: (uri: string) => void | Promise<void>
}

/**
 * Loads the WalletConnect React Native shims. This must run before the core
 * adapter imports SignClient.
 *
 * The `require` is a literal inside a `try` block on purpose: that is the form
 * Metro recognises as an optional dependency, so an app that never configures
 * WalletConnect still bundles without the package installed.
 */
function loadWalletConnectCompat(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@walletconnect/react-native-compat")
  } catch {
    throw new WalletAdapterError(
      "wallet_unavailable",
      "WalletConnect needs @walletconnect/react-native-compat. " +
        "Install it: npm install @walletconnect/react-native-compat @walletconnect/sign-client"
    )
  }
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

  loadWalletConnectCompat()

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

      // No wallet installed for the `wc:` scheme rejects; the QR fallback
      // remains available through onPairingUri.
      void Promise.resolve()
        .then(() => Linking.openURL(uri))
        .catch(() => undefined)
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

/** Options for {@link configureReactNativeLobstrAdapter}. */
export type ReactNativeLobstrOptions = LobstrAdapterOptions

/**
 * Enables `connect("lobstr")` in a native app. Call once at startup.
 *
 * On a device the LOBSTR app is opened directly with its WalletConnect deep
 * link (`lobstr://wc?uri=...`). When LOBSTR is not installed the link is
 * rejected and the pairing URI is still delivered to `onDisplayUri` for a QR
 * fallback. Pass `openWallet` to replace the default `Linking.openURL`.
 *
 * @throws {WalletAdapterError} `wallet_unavailable` when `projectId` is empty
 *         or `@walletconnect/react-native-compat` is not installed.
 */
export function configureReactNativeLobstrAdapter(options: ReactNativeLobstrOptions): void {
  if (!options?.projectId?.trim()) {
    // Let core raise the error that explains how to get a project ID.
    configureLobstrAdapter(options)
    return
  }

  loadWalletConnectCompat()

  configureLobstrAdapter({
    ...options,
    openWallet:
      options.openWallet ??
      (async deepLink => {
        await Linking.openURL(deepLink)
      }),
  })
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
