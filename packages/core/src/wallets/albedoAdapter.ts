import type { StellarNetwork } from "../types"
import { getNetworkPassphrase } from "../types"
import type {
  WalletAdapter,
  WalletConnection,
  WalletNetworkDetails,
  SignTransactionOptions,
} from "./types"
import { WalletAdapterError } from "./types"

function toAlbedoNetwork(network: StellarNetwork): "public" | "testnet" {
  return network === "mainnet" ? "public" : "testnet"
}

/**
 * The passphrase Albedo should be signing against.
 *
 * Albedo confirms the network per request rather than exposing a current one,
 * so a custom network cannot be validated here — the provider's resolved
 * config is the authority, and an unknown network is rejected rather than
 * silently signed against a guess.
 */
function requirePassphrase(network: StellarNetwork): string {
  const passphrase = getNetworkPassphrase(network)

  if (!passphrase) {
    throw new WalletAdapterError(
      "wallet_unsupported",
      `Albedo cannot be used with network="${network}" — it has no published passphrase. ` +
        "Use a wallet that reports its own network, or switch to testnet, mainnet, or futurenet."
    )
  }

  return passphrase
}

interface AlbedoApi {
  publicKey: (options: object) => Promise<{ pubkey: string }>
  tx: (options: {
    xdr: string
    network: "public" | "testnet"
    pubkey: string
    submit: boolean
  }) => Promise<{ signed_envelope_xdr: string }>
}

/**
 * Loads `@albedo-link/intent` lazily.
 *
 * Albedo is an optional peer dependency — a consumer who only uses another
 * wallet should not have to install it. When it is missing, the dynamic import
 * rejects with a module resolution error, which must surface as a typed
 * `wallet_unavailable` naming the package to install, not as an unhandled
 * rejection or a raw bundler error.
 */
async function loadAlbedo(): Promise<AlbedoApi> {
  try {
    const albedoModule = await import("@albedo-link/intent")
    return albedoModule.default ?? albedoModule
  } catch {
    throw new WalletAdapterError(
      "wallet_unavailable",
      'Package "@albedo-link/intent" is not installed. ' +
        "Install it to use the Albedo wallet: npm install @albedo-link/intent"
    )
  }
}

export const albedoAdapter: WalletAdapter = {
  metadata: {
    type: "albedo",
    name: "Albedo",
    supported: true,
  },

  async isAvailable() {
    // Albedo is web-popup based — no extension required, always available in a browser.
    return typeof window !== "undefined"
  },

  async connect(network: StellarNetwork): Promise<WalletConnection> {
    const albedo = await loadAlbedo()

    try {
      const result = await albedo.publicKey({})

      if (!result.pubkey) {
        throw new WalletAdapterError(
          "wallet_access_rejected",
          "Albedo did not return a public key."
        )
      }

      return {
        address: result.pubkey,
        wallet: "albedo",
        network,
        networkPassphrase: requirePassphrase(network),
      }
    } catch (err) {
      if (err instanceof WalletAdapterError) throw err
      throw new WalletAdapterError(
        "wallet_access_rejected",
        err instanceof Error ? err.message : "Albedo connection was rejected."
      )
    }
  },

  async getNetworkDetails(network: StellarNetwork): Promise<WalletNetworkDetails> {
    // Albedo doesn't expose a standalone "current network" query — the network
    // is confirmed per-request (connect/sign), so we return the requested network.
    return {
      network,
      networkPassphrase: requirePassphrase(network),
    }
  },

  async signTransaction(xdr: string, options: SignTransactionOptions): Promise<string> {
    const albedo = await loadAlbedo()

    try {
      const result = await albedo.tx({
        xdr,
        network: toAlbedoNetwork(options.network),
        pubkey: options.address,
        submit: false,
      })

      if (!result.signed_envelope_xdr) {
        throw new WalletAdapterError(
          "wallet_sign_failed",
          "Albedo did not return a signed transaction."
        )
      }

      return result.signed_envelope_xdr
    } catch (err) {
      if (err instanceof WalletAdapterError) throw err
      throw new WalletAdapterError(
        "wallet_sign_failed",
        err instanceof Error ? err.message : "Albedo failed to sign the transaction."
      )
    }
  },
}
