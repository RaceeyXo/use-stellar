import type { StellarNetwork, WalletNetworkId } from "../types"
import { NETWORK_PASSPHRASES } from "../types"
import type { SignTransactionOptions, WalletAdapter, WalletNetworkDetails } from "./types"
import { WalletAdapterError } from "./types"

type RabetNetwork = "mainnet" | "testnet"
type RabetEvent = "accountChanged" | "networkChanged"

interface RabetConnectResult {
  publicKey: string
  error?: string
}

interface RabetSignResult {
  xdr: string
  error?: string
}

interface RabetProvider {
  connect: () => Promise<RabetConnectResult>
  sign: (xdr: string, network: RabetNetwork) => Promise<RabetSignResult>
  disconnect?: () => Promise<void>
  on: (event: RabetEvent, handler: (value?: unknown) => void) => void
  off?: (event: RabetEvent, handler: (value?: unknown) => void) => void
  removeListener?: (event: RabetEvent, handler: (value?: unknown) => void) => void
}

let connectedAddress: string | null = null
let connectedNetwork: WalletNetworkId = "custom"
let connectedPassphrase = ""

function injectedProvider(): RabetProvider | undefined {
  if (typeof window === "undefined") return undefined
  return (window as Window & { rabet?: RabetProvider }).rabet
}

function requireProvider(): RabetProvider {
  const provider = injectedProvider()
  if (!provider) {
    throw new WalletAdapterError(
      "wallet_unavailable",
      "Rabet wallet not found. Install and unlock the Rabet browser extension."
    )
  }
  return provider
}

function requireWebRuntime(): void {
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    throw new WalletAdapterError("wallet_unavailable", "Rabet cannot be used inside a native app.")
  }
}

function networkDetails(network: StellarNetwork): WalletNetworkDetails & {
  rabetNetwork: RabetNetwork
} {
  if (network !== "mainnet" && network !== "testnet") {
    throw new WalletAdapterError(
      "wallet_network_mismatch",
      `Rabet cannot sign for network="${network}". Use mainnet or testnet.`
    )
  }

  return {
    network,
    networkPassphrase: NETWORK_PASSPHRASES[network],
    rabetNetwork: network,
  }
}

function networkFromPassphrase(passphrase: string): WalletNetworkDetails & {
  rabetNetwork: RabetNetwork
} {
  if (passphrase === NETWORK_PASSPHRASES.mainnet) return networkDetails("mainnet")
  if (passphrase === NETWORK_PASSPHRASES.testnet) return networkDetails("testnet")

  throw new WalletAdapterError(
    "wallet_network_mismatch",
    "Rabet only signs transactions for the public or test network passphrase."
  )
}

function isUserRejection(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    if ((error as { code?: unknown }).code === 4001) return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return /reject|denied|declined|cancel/i.test(message)
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return fallback
}

function parseAccount(value: unknown): string | null {
  if (typeof value === "string") return value || null
  if (typeof value === "object" && value !== null && "publicKey" in value) {
    const publicKey = (value as { publicKey?: unknown }).publicKey
    return typeof publicKey === "string" && publicKey ? publicKey : null
  }
  return null
}

function parseNetwork(value: unknown): WalletNetworkDetails | null {
  if (value === "mainnet" || value === "public" || value === NETWORK_PASSPHRASES.mainnet) {
    return networkDetails("mainnet")
  }
  if (value === "testnet" || value === "test" || value === NETWORK_PASSPHRASES.testnet) {
    return networkDetails("testnet")
  }
  return null
}

export const rabetAdapter: WalletAdapter = {
  metadata: {
    type: "rabet",
    name: "Rabet",
    supported: true,
    platforms: ["web"],
  },

  async isAvailable() {
    if (typeof navigator !== "undefined" && navigator.product === "ReactNative") return false
    return Boolean(injectedProvider())
  },

  async connect(network) {
    requireWebRuntime()
    const details = networkDetails(network)
    const provider = requireProvider()

    try {
      const result = await provider.connect()
      if (result.error) throw new Error(result.error)
      if (!result.publicKey) {
        throw new WalletAdapterError("wallet_access_rejected", "Rabet did not return a public key.")
      }

      connectedAddress = result.publicKey
      connectedNetwork = details.network
      connectedPassphrase = details.networkPassphrase

      return {
        address: result.publicKey,
        wallet: "rabet",
        network: details.network,
        networkPassphrase: details.networkPassphrase,
      }
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error
      throw new WalletAdapterError(
        isUserRejection(error) ? "wallet_access_rejected" : "wallet_unavailable",
        messageOf(error, "Rabet connection failed.")
      )
    }
  },

  async disconnect() {
    const provider = requireProvider()
    await provider.disconnect?.()
    connectedAddress = null
  },

  async getNetworkDetails(network) {
    const details = networkDetails(network)
    return { network: details.network, networkPassphrase: details.networkPassphrase }
  },

  subscribe(handler) {
    const provider = injectedProvider()
    if (!provider) return () => {}

    const onAccountChanged = (value?: unknown) => {
      connectedAddress = parseAccount(value)
      handler({
        address: connectedAddress,
        network: connectedNetwork,
        networkPassphrase: connectedPassphrase,
      })
    }
    const onNetworkChanged = (value?: unknown) => {
      const details = parseNetwork(value)
      if (!details) return
      connectedNetwork = details.network
      connectedPassphrase = details.networkPassphrase
      handler({
        address: connectedAddress,
        network: connectedNetwork,
        networkPassphrase: connectedPassphrase,
      })
    }

    provider.on("accountChanged", onAccountChanged)
    provider.on("networkChanged", onNetworkChanged)

    return () => {
      const remove = provider.off?.bind(provider) ?? provider.removeListener?.bind(provider)
      remove?.("accountChanged", onAccountChanged)
      remove?.("networkChanged", onNetworkChanged)
    }
  },

  async signTransaction(xdr, options: SignTransactionOptions) {
    requireWebRuntime()
    const provider = requireProvider()
    const details = networkFromPassphrase(options.networkPassphrase)

    try {
      const result = await provider.sign(xdr, details.rabetNetwork)
      if (result.error) throw new Error(result.error)
      if (!result.xdr) {
        throw new WalletAdapterError("wallet_sign_failed", "Rabet did not return signed XDR.")
      }
      return result.xdr
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error
      throw new WalletAdapterError(
        isUserRejection(error) ? "wallet_access_rejected" : "wallet_sign_failed",
        messageOf(error, "Rabet failed to sign the transaction.")
      )
    }
  },
}
