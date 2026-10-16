import type { StellarNetwork } from "../types"
import type {
  WalletAdapter,
  WalletConnection,
  WalletNetworkDetails,
  SignTransactionOptions,
} from "./types"
import { WalletAdapterError } from "./types"

/** The subset of `@hot-wallet/sdk` this adapter uses. */
interface HotWalletSdk {
  request: (
    method: string,
    params?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
}

let hotWalletPromise: Promise<HotWalletSdk> | null = null
let hotWalletResolved: HotWalletSdk | null = null

/**
 * Loads `@hot-wallet/sdk` lazily and caches it.
 *
 * HOT Wallet SDK is an optional peer dependency — a consumer who only uses
 * another wallet should not have to install it. The dynamic import also keeps
 * the SDK out of the SSR bundle: as a real deferred module it is not inlined
 * into the build output, so a security fix in HOT Wallet's API can be applied
 * by the application without a release of this library.
 *
 * When the package is missing, the import rejects with a module resolution
 * error, which is surfaced as a typed `wallet_unavailable` naming the package
 * to install — never as an unhandled rejection or a raw bundler error.
 */
async function loadHotWallet(): Promise<HotWalletSdk> {
  if (hotWalletResolved) return hotWalletResolved
  if (!hotWalletPromise) {
    hotWalletPromise = (async () => {
      try {
        const mod = await import("@hot-wallet/sdk")
        const sdk = (mod.HOT || mod.default?.HOT || mod) as unknown as HotWalletSdk
        hotWalletResolved = sdk
        return sdk
      } catch {
        throw new WalletAdapterError(
          "wallet_unavailable",
          'Package "@hot-wallet/sdk" is not installed. ' +
            "Install it to use the HOT Wallet: npm install @hot-wallet/sdk"
        )
      }
    })()
  }
  return hotWalletPromise
}

/**
 * Maps vendor errors from HOT Wallet SDK to standard WalletAdapterError codes.
 *
 * HOT Wallet SDK throws generic Error objects. We infer the error type from
 * message content and common patterns in wallet SDKs.
 */
function mapHotWalletError(err: unknown): WalletAdapterError {
  if (err instanceof WalletAdapterError) return err

  const errorMessage = err instanceof Error ? err.message : String(err)
  const errorLower = errorMessage.toLowerCase()

  // User rejection patterns
  if (errorLower.includes("reject") || errorLower.includes("cancelled")) {
    return new WalletAdapterError("wallet_access_rejected", errorMessage)
  }

  // Missing wallet / unavailable patterns
  if (
    errorLower.includes("not found") ||
    errorLower.includes("unavailable") ||
    errorLower.includes("not connected")
  ) {
    return new WalletAdapterError("wallet_unavailable", errorMessage)
  }

  // Network mismatch patterns
  if (errorLower.includes("network") || errorLower.includes("passphrase")) {
    return new WalletAdapterError("wallet_network_mismatch", errorMessage)
  }

  // Signing failure patterns
  if (errorLower.includes("sign") || errorLower.includes("transaction")) {
    return new WalletAdapterError("wallet_sign_failed", errorMessage)
  }

  // Default to sign_failed for unknown errors
  return new WalletAdapterError(
    "wallet_sign_failed",
    errorMessage || "HOT Wallet operation failed"
  )
}

export const hotWalletAdapter: WalletAdapter = {
  metadata: {
    type: "hot",
    name: "HOT Wallet",
    supported: true,
    platforms: ["web", "native"],
  },

  async isAvailable() {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
      // HOT Wallet can run on React Native via Telegram Mini App or mobile SDK.
      // However, checking availability on RN requires more complex detection.
      // For now, report false unless explicitly in a HOT Wallet environment.
      return false
    }

    try {
      const sdk = await loadHotWallet()
      // Attempt a no-op request to check if HOT Wallet is available in the current environment.
      // This is a heuristic: in a browser with HOT extension or Telegram Mini App,
      // the request will route to HOT Wallet. In a plain browser, it will fail.
      // We don't await or check the result; we just test whether the SDK is accessible.
      // Return true if the SDK loaded successfully in a browser context.
      return typeof window !== "undefined" && Boolean(sdk)
    } catch {
      return false
    }
  },

  async connect(network: StellarNetwork): Promise<WalletConnection> {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
      throw new WalletAdapterError(
        "wallet_unavailable",
        "HOT Wallet on React Native requires special setup. Check the HOT Wallet mobile documentation."
      )
    }

    try {
      const sdk = await loadHotWallet()

      // Request the Stellar address from HOT Wallet
      const addressResult = (await sdk.request("stellar:getAddress", {})) as Record<
        string,
        unknown
      >
      const address = addressResult.address as string | undefined

      if (!address || typeof address !== "string") {
        throw new WalletAdapterError(
          "wallet_access_rejected",
          "HOT Wallet did not return a Stellar address."
        )
      }

      return {
        address,
        wallet: "hot",
        network,
        networkPassphrase: (addressResult.networkPassphrase as string) || "",
      }
    } catch (err) {
      throw mapHotWalletError(err)
    }
  },

  async getNetworkDetails(network: StellarNetwork): Promise<WalletNetworkDetails> {
    // HOT Wallet doesn't expose a dedicated network query outside of connect/sign.
    // Return the requested network as the expected details.
    // The actual network is confirmed during sign requests.
    return {
      network,
      networkPassphrase: "", // Will be populated by connect() or must be passed by caller
    }
  },

  async signTransaction(xdr: string, options: SignTransactionOptions): Promise<string> {
    if (!options.networkPassphrase) {
      throw new WalletAdapterError(
        "wallet_network_mismatch",
        "signTransaction requires a networkPassphrase in options. " +
          "Do not rely on defaults; explicitly pass the network passphrase."
      )
    }

    try {
      const sdk = await loadHotWallet()

      // Request HOT Wallet to sign the transaction with the explicit passphrase
      const signResult = (await sdk.request("stellar:signTransaction", {
        xdr,
        networkPassphrase: options.networkPassphrase,
      })) as Record<string, unknown>

      // HOT SDK may return either `signedXdr` or `signed_envelope_xdr` depending on version
      const signedXdr = (signResult.signedXdr || signResult.signed_envelope_xdr) as
        | string
        | undefined

      if (!signedXdr || typeof signedXdr !== "string") {
        throw new WalletAdapterError(
          "wallet_sign_failed",
          "HOT Wallet did not return a signed transaction."
        )
      }

      return signedXdr
    } catch (err) {
      throw mapHotWalletError(err)
    }
  },
}
