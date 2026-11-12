import type { StellarNetwork } from "../types"
import type {
  WalletAdapter,
  WalletConnection,
  WalletNetworkDetails,
  SignTransactionOptions,
} from "./types"
import { WalletAdapterError } from "./types"
import { getNetworkPassphrase } from "../types"

/**
 * Configuration required for the Trezor adapter.
 * Trezor Connect requires manifest details identifying the integrating app.
 */
export interface TrezorAdapterConfig {
  /**
   * The email address associated with your application.
   * Required by Trezor Connect for manifest identification.
   */
  email: string
  /**
   * The URL of your application.
   * Required by Trezor Connect for manifest identification.
   */
  appUrl: string
}

/** The subset of `@trezor/connect` this adapter uses. */
interface TrezorConnectApi {
  init: (options: {
    manifest: {
      email: string
      appUrl: string
    }
  }) => Promise<void>
  stellarGetAddress: (params: { path: string | number[]; showOnTrezor?: boolean }) => Promise<{
    success: boolean
    payload:
      | {
          address: string
          path?: number[]
          serializedPath?: string
        }
      | { error: string }
  }>
  stellarSignTransaction: (params: {
    path: string | number[]
    networkPassphrase: string
    xdrBase64: string
  }) => Promise<{
    success: boolean
    payload:
      | {
          publicKey: string
          signature: string
        }
      | { error: string }
  }>
}

let trezorPromise: Promise<TrezorConnectApi> | null = null
let trezorResolved: TrezorConnectApi | null = null
let trezorConfig: TrezorAdapterConfig | null = null

/**
 * Sets the Trezor adapter configuration.
 *
 * Must be called before using the Trezor adapter. Trezor Connect requires
 * manifest details (email and appUrl) to identify the integrating application.
 *
 * @param config - Configuration with email and appUrl for Trezor Connect manifest
 * @throws {WalletAdapterError} if config is missing required fields
 *
 * @example
 * configureTrezorAdapter({
 *   email: "contact@myapp.com",
 *   appUrl: "https://myapp.com"
 * })
 */
export function configureTrezorAdapter(config: TrezorAdapterConfig): void {
  if (!config?.email || typeof config.email !== "string") {
    throw new WalletAdapterError(
      "wallet_unavailable",
      "Trezor adapter requires manifest email configuration. " +
        "Call configureTrezorAdapter({ email: '...', appUrl: '...' }) before using the adapter."
    )
  }

  if (!config?.appUrl || typeof config.appUrl !== "string") {
    throw new WalletAdapterError(
      "wallet_unavailable",
      "Trezor adapter requires manifest appUrl configuration. " +
        "Call configureTrezorAdapter({ email: '...', appUrl: '...' }) before using the adapter."
    )
  }

  trezorConfig = config
}

/**
 * Loads `@trezor/connect` lazily and initializes it with manifest config.
 *
 * Trezor Connect is an optional peer dependency — a consumer who only uses
 * another wallet should not have to install it. The dynamic import also keeps
 * the SDK out of the SSR bundle: as a real deferred module it is not inlined
 * into the build output, so a security fix can be applied without a release
 * of this library.
 *
 * When the package is missing or config is not set, the import rejects with a
 * typed `wallet_unavailable` error — never as an unhandled rejection or raw
 * bundler error.
 */
async function loadTrezor(): Promise<TrezorConnectApi> {
  if (trezorResolved) return trezorResolved
  if (!trezorPromise) {
    trezorPromise = (async () => {
      try {
        if (!trezorConfig) {
          throw new Error("Trezor adapter not configured")
        }

        // Optional peer dependency: it may or may not be installed where this
        // compiles, so it is typed here rather than by its own declarations, and
        // `@ts-ignore` (not `@ts-expect-error`) holds either way. The specifier stays
        // a literal so bundlers resolve it.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const imported = (await import("@trezor/connect")) as {
          default?: TrezorConnectApi
        } & TrezorConnectApi
        // Trezor Connect is a default export; a CommonJS interop may flatten it.
        const mod = imported.default ?? imported
        if (typeof mod.init !== "function") {
          throw new Error("@trezor/connect does not export init function")
        }

        await mod.init({
          manifest: {
            email: trezorConfig.email,
            appUrl: trezorConfig.appUrl,
          },
        })

        trezorResolved = mod
        return mod
      } catch (err) {
        // Clear the promise so retries can attempt to load again (e.g., after config is set)
        trezorPromise = null

        if (err instanceof Error && err.message === "Trezor adapter not configured") {
          throw new WalletAdapterError(
            "wallet_unavailable",
            "Trezor adapter is not configured. " +
              "Call configureTrezorAdapter({ email: '...', appUrl: '...' }) before connecting."
          )
        }

        throw new WalletAdapterError(
          "wallet_unavailable",
          'Package "@trezor/connect" is not installed. ' +
            "Install it to use the Trezor wallet: npm install @trezor/connect"
        )
      }
    })()
  }
  return trezorPromise
}

/**
 * Maps Trezor Connect error responses to WalletAdapterError codes.
 *
 * Documents the vendor error surface and how it aligns with the shared contract.
 */
function mapTrezorError(err: unknown): WalletAdapterError {
  if (err instanceof WalletAdapterError) return err

  const message = err instanceof Error ? err.message : String(err)
  // Trezor Connect's messages are not consistently cased ("Bridge is not running").
  const lower = message.toLowerCase()

  // User rejection or cancellation on device or in popup
  if (
    lower.includes("cancelled") ||
    lower.includes("rejected") ||
    lower.includes("user denied") ||
    lower.includes("action cancelled")
  ) {
    return new WalletAdapterError("wallet_access_rejected", message)
  }

  // Device/bridge not available
  if (
    lower.includes("not found") ||
    lower.includes("unavailable") ||
    lower.includes("bridge") ||
    lower.includes("not connected") ||
    lower.includes("device is not available")
  ) {
    return new WalletAdapterError("wallet_unavailable", message)
  }

  // Network mismatch (Trezor device on wrong chain)
  if (lower.includes("network") || lower.includes("passphrase") || lower.includes("mismatch")) {
    return new WalletAdapterError("wallet_network_mismatch", message)
  }

  // Generic signing failure
  return new WalletAdapterError("wallet_sign_failed", message)
}

/** Hex (as Trezor Connect returns signatures) to base64 (as the Stellar SDK takes them). */
function hexToBase64(hex: string): string {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) {
    throw new WalletAdapterError("wallet_sign_failed", "Trezor returned a malformed signature.")
  }
  let binary = ""
  for (let i = 0; i < hex.length; i += 2)
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return btoa(binary)
}

/**
 * Derives the Trezor BIP32 path for a given account index.
 *
 * Standard Stellar path: m/44'/148'/account'
 * where account defaults to 0 and can be customized.
 */
function derivePath(accountIndex: number = 0): string {
  return `m/44'/148'/${accountIndex}'`
}

async function getTrezorNetworkDetails(network: StellarNetwork): Promise<WalletNetworkDetails> {
  const passphrase = getNetworkPassphrase(network)

  if (!passphrase) {
    throw new WalletAdapterError(
      "wallet_unsupported",
      `Trezor cannot be used with network="${network}" — it has no published passphrase. ` +
        "Use testnet, mainnet, or futurenet."
    )
  }

  return {
    network,
    networkPassphrase: passphrase,
  }
}

export const trezorAdapter: WalletAdapter = {
  metadata: {
    type: "trezor",
    name: "Trezor",
    supported: true,
    platforms: ["web"],
  },

  async isAvailable() {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") return false

    try {
      await loadTrezor()
      return true
    } catch {
      return false
    }
  },

  async connect(network: StellarNetwork): Promise<WalletConnection> {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
      throw new WalletAdapterError(
        "wallet_unavailable",
        "Trezor cannot be used inside a native app."
      )
    }

    try {
      // Before the device is involved: an unsupported network must not cost the
      // user a confirmation on their Trezor first.
      const networkDetails = await getTrezorNetworkDetails(network)

      const trezor = await loadTrezor()
      const path = derivePath(0) // Use default account 0

      const result = await trezor.stellarGetAddress({
        path,
        showOnTrezor: true,
      })

      if (!result.success) {
        const error = result.payload as { error?: string }
        throw new Error(error?.error || "Failed to get Trezor address")
      }

      const payload = result.payload as { address?: string }
      if (!payload.address) {
        throw new WalletAdapterError(
          "wallet_access_rejected",
          "Trezor did not return a wallet address."
        )
      }

      return {
        address: payload.address,
        wallet: "trezor",
        ...networkDetails,
      }
    } catch (err) {
      throw mapTrezorError(err)
    }
  },

  async getNetworkDetails(network: StellarNetwork): Promise<WalletNetworkDetails> {
    return getTrezorNetworkDetails(network)
  },

  async signTransaction(xdr: string, options: SignTransactionOptions): Promise<string> {
    try {
      const trezor = await loadTrezor()
      const path = derivePath(0) // Use default account 0

      // Validate network passphrase is provided
      if (!options.networkPassphrase) {
        throw new WalletAdapterError(
          "wallet_sign_failed",
          "Network passphrase is required for signing but was not provided."
        )
      }

      const result = await trezor.stellarSignTransaction({
        path,
        networkPassphrase: options.networkPassphrase,
        xdrBase64: xdr,
      })

      if (!result.success) {
        const error = result.payload as { error?: string }
        throw new Error(error?.error || "Trezor failed to sign the transaction")
      }

      const payload = result.payload as { publicKey?: string; signature?: string }
      if (!payload.signature) {
        throw new WalletAdapterError("wallet_sign_failed", "Trezor did not return a signature.")
      }

      // Trezor returns the raw signature as hex; a decorated signature is added
      // with the signer's G-address and the signature in base64. The signer is
      // the account the transaction is being signed for, and `addSignature`
      // verifies the signature against it — a signature from another key, or
      // over another transaction, throws here instead of producing an envelope
      // Horizon would reject.
      const { TransactionBuilder } = await import("@stellar/stellar-sdk")
      const tx = TransactionBuilder.fromXDR(xdr, options.networkPassphrase)
      tx.addSignature(options.address, hexToBase64(payload.signature))

      return tx.toXDR()
    } catch (err) {
      throw mapTrezorError(err)
    }
  },
}
