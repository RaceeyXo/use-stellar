import type { StellarNetwork } from "../types"
import { getNetworkPassphrase } from "../types"
import type { WalletAdapter, WalletNetworkDetails } from "./types"
import { WalletAdapterError } from "./types"

/** The subset of `@creit.tech/xbull-wallet-connect` this adapter uses. */
interface XBullWalletConnectApi {
  connect: () => Promise<string>
  sign: (params: { xdr: string; publicKey?: string; network?: string }) => Promise<string>
  closeConnections: () => void
}

interface XBullWalletConnectConstructor {
  new (options?: { url?: string; preferredTarget?: "extension" | "website" }): XBullWalletConnectApi
}

let xbullPromise: Promise<XBullWalletConnectConstructor> | null = null
let xbullResolved: XBullWalletConnectConstructor | null = null

/**
 * Loads `@creit.tech/xbull-wallet-connect` lazily and caches it.
 *
 * xBull is an optional peer dependency — a consumer who only uses another
 * wallet should not have to install it. The dynamic import also keeps the SDK
 * out of the SSR bundle: as a real deferred module it is not inlined into the
 * build output, so a security fix in xBull's API can be applied by the
 * application without a release of this library.
 *
 * When the package is missing, the import rejects with a module resolution
 * error, which is surfaced as a typed `wallet_unavailable` naming the package
 * to install — never as an unhandled rejection or a raw bundler error.
 */
async function loadXBull(): Promise<XBullWalletConnectConstructor> {
  if (xbullResolved) return xbullResolved
  if (!xbullPromise) {
    xbullPromise = (async () => {
      try {
        const mod = await import("@creit.tech/xbull-wallet-connect")
        // The module exports the class as default
        const XBullWalletConnect = (mod.default as unknown) as XBullWalletConnectConstructor
        xbullResolved = XBullWalletConnect
        return XBullWalletConnect
      } catch {
        throw new WalletAdapterError(
          "wallet_unavailable",
          'Package "@creit.tech/xbull-wallet-connect" is not installed. ' +
            "Install it to use the xBull wallet: npm install @creit.tech/xbull-wallet-connect"
        )
      }
    })()
  }
  return xbullPromise
}

/**
 * Maps xBull error messages to wallet adapter error codes.
 *
 * xBull errors are typically returned as rejected promises with string or
 * Error messages. We categorize them based on common patterns.
 */
function mapXBullError(error: unknown): { code: "wallet_access_rejected" | "wallet_sign_failed"; message: string } {
  const message = error instanceof Error ? error.message : String(error)

  // Check for rejection/cancellation patterns
  if (
    message.toLowerCase().includes("reject") ||
    message.toLowerCase().includes("cancel") ||
    message.toLowerCase().includes("denied") ||
    message.toLowerCase().includes("user")
  ) {
    return { code: "wallet_access_rejected", message }
  }

  // Check for signing-specific errors
  if (
    message.toLowerCase().includes("sign") ||
    message.toLowerCase().includes("transaction")
  ) {
    return { code: "wallet_sign_failed", message }
  }

  // Default to sign_failed for signing operations, access_rejected for others
  // This is set by the caller based on context
  return { code: "wallet_sign_failed", message }
}

export const xbullAdapter: WalletAdapter = {
  metadata: {
    type: "xbull",
    name: "xBull",
    supported: true,
    platforms: ["web"],
  },

  async isAvailable() {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") return false
    
    try {
      await loadXBull()
      // xBull is available in browser through extension or webapp
      return typeof window !== "undefined"
    } catch {
      return false
    }
  },

  async connect(network: StellarNetwork) {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
      throw new WalletAdapterError(
        "wallet_unavailable",
        "xBull cannot be used inside a native app."
      )
    }

    const XBullWalletConnect = await loadXBull()

    try {
      const bridge = new XBullWalletConnect()
      
      try {
        const publicKey = await bridge.connect()

        if (!publicKey) {
          throw new WalletAdapterError(
            "wallet_access_rejected",
            "xBull did not return a public key."
          )
        }

        // Get the network passphrase for the requested network
        const networkDetails = await xbullAdapter.getNetworkDetails(network)

        return {
          address: publicKey,
          wallet: "xbull",
          ...networkDetails,
        }
      } finally {
        bridge.closeConnections()
      }
    } catch (err) {
      if (err instanceof WalletAdapterError) throw err
      
      const { code, message } = mapXBullError(err)
      throw new WalletAdapterError(code, message)
    }
  },

  async getNetworkDetails(network: StellarNetwork): Promise<WalletNetworkDetails> {
    // xBull doesn't expose a way to query the current network directly
    // Similar to Albedo, we return the requested network and its passphrase
    // The network must be validated by the application
    const passphrase = getXBullNetworkPassphrase(network)

    return {
      network,
      networkPassphrase: passphrase,
    }
  },

  async signTransaction(xdr: string, options) {
    const XBullWalletConnect = await loadXBull()

    try {
      const bridge = new XBullWalletConnect()

      try {
        // Get the network identifier that xBull expects
        const xbullNetwork = toXBullNetwork(options.network)

        const signedXdr = await bridge.sign({
          xdr,
          publicKey: options.address,
          network: xbullNetwork,
        })

        if (!signedXdr) {
          throw new WalletAdapterError(
            "wallet_sign_failed",
            "xBull did not return a signed transaction."
          )
        }

        return signedXdr
      } finally {
        bridge.closeConnections()
      }
    } catch (err) {
      if (err instanceof WalletAdapterError) throw err

      const { code, message } = mapXBullError(err)
      // For signing operations, prefer wallet_sign_failed
      const finalCode = code === "wallet_access_rejected" && message.toLowerCase().includes("reject") 
        ? "wallet_access_rejected" 
        : "wallet_sign_failed"
      
      throw new WalletAdapterError(finalCode, message)
    }
  },
}

/**
 * Maps Stellar networks to the network identifiers xBull expects.
 *
 * xBull uses network identifiers like "testnet", "mainnet", etc.
 */
function toXBullNetwork(network: StellarNetwork): string {
  switch (network) {
    case "mainnet":
      return "mainnet"
    case "testnet":
      return "testnet"
    case "futurenet":
      return "futurenet"
    case "custom":
      return "custom"
    default:
      return network
  }
}

/**
 * Returns the network passphrase for xBull to sign with.
 *
 * xBull requires the network passphrase when signing transactions.
 */
function getXBullNetworkPassphrase(network: StellarNetwork): string {
  const passphrase = getNetworkPassphrase(network)

  if (!passphrase) {
    throw new WalletAdapterError(
      "wallet_unsupported",
      `xBull cannot be used with network="${network}" — it has no published passphrase. ` +
        "Use a wallet that reports its own network, or switch to testnet, mainnet, or futurenet."
    )
  }

  return passphrase
}
