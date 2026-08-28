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
    // Dynamic import keeps @albedo-link/intent out of the SSR/test bundle.
    const albedoModule = await import("@albedo-link/intent")
    const albedo = albedoModule.default ?? albedoModule

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
    const albedoModule = await import("@albedo-link/intent")
    const albedo = albedoModule.default ?? albedoModule

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
