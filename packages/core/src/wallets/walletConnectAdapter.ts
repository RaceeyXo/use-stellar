/* eslint-disable */
import type { StellarNetwork, WalletNetworkId } from "../types"
import { NETWORK_PASSPHRASES, getNetworkPassphrase } from "../types"
import type { WalletAdapter } from "./types"
import { WalletAdapterError } from "./types"

// Vendor types
type SignClientEvent = "session_update" | "session_delete"
interface SessionStruct {
  topic: string
  namespaces: Record<
    string,
    {
      accounts: string[]
      methods: string[]
      events: string[]
    }
  >
}
interface SessionUpdateEvent {
  params?: { namespaces?: { stellar?: { accounts?: string[] } } }
}
interface SignClient {
  connect: (params: {
    requiredNamespaces: Record<string, unknown>
    optionalNamespaces?: Record<string, unknown>
  }) => Promise<{ uri?: string; approval: () => Promise<SessionStruct> }>
  request: (params: {
    topic: string
    chainId: string
    request: { method: string; params: unknown }
  }) => Promise<unknown>
  disconnect: (params: {
    topic: string
    reason: { code: number; message: string }
  }) => Promise<void>
  session: {
    values: SessionStruct[]
    get: (topic: string) => SessionStruct
  }
  on: (event: SignClientEvent, listener: (args: SessionUpdateEvent) => void) => void
  removeListener: (event: SignClientEvent, listener: (args: SessionUpdateEvent) => void) => void
}

let signClientPromise: Promise<SignClient> | null = null
let signClientResolved: SignClient | null = null

/** Reads `message` / `code` from an unknown thrown value. */
function errorInfo(err: unknown): { message?: string; code?: unknown } {
  if (typeof err !== "object" || err === null) return {}
  const { message, code } = err as { message?: unknown; code?: unknown }
  return { message: typeof message === "string" ? message : undefined, code }
}

async function loadSignClient(
  projectId: string,
  metadata: CreateWalletConnectAdapterOptions["metadata"],
  storage?: unknown
): Promise<SignClient> {
  if (signClientResolved) return signClientResolved
  if (!signClientPromise) {
    signClientPromise = (async () => {
      try {
        // @ts-expect-error -- optional peer dependency, absent from this repo's install
        const { SignClient } = await import("@walletconnect/sign-client")
        const client = await SignClient.init({
          projectId,
          metadata,
          storage,
        })
        signClientResolved = client as unknown as SignClient
        return client as unknown as SignClient
      } catch {
        throw new WalletAdapterError(
          "wallet_unavailable",
          "WalletConnect SignClient failed to load. Is @walletconnect/sign-client installed?"
        )
      }
    })()
  }
  return signClientPromise
}

export function resolveNetworkFromPassphrase(passphrase: string): WalletNetworkId {
  const match = (Object.keys(NETWORK_PASSPHRASES) as (keyof typeof NETWORK_PASSPHRASES)[]).find(
    network => NETWORK_PASSPHRASES[network] === passphrase
  )
  return match ?? "custom"
}

function getStellarChainId(network: StellarNetwork): string {
  if (network === "mainnet") return "stellar:pubnet"
  if (network === "testnet") return "stellar:testnet"
  return `stellar:${network}`
}

function getPassphraseFromChainId(chainId: string): string {
  if (chainId === "stellar:pubnet") return NETWORK_PASSPHRASES.mainnet
  if (chainId === "stellar:testnet") return NETWORK_PASSPHRASES.testnet
  return ""
}

export interface CreateWalletConnectAdapterOptions {
  projectId: string
  metadata: {
    name: string
    description: string
    url: string
    icons: string[]
  }
  storage?: unknown
  onDisplayUri?: (uri: string) => void
}

export function createWalletConnectAdapter({
  projectId,
  metadata,
  storage,
  onDisplayUri,
}: CreateWalletConnectAdapterOptions): WalletAdapter {
  return {
    metadata: {
      type: "walletconnect",
      name: "WalletConnect",
      supported: true,
      platforms: ["web", "native"],
    },

    async isAvailable() {
      return true
    },

    async connect(network) {
      const client = await loadSignClient(projectId, metadata, storage)
      const chainId = getStellarChainId(network)

      const requiredNamespaces = {
        stellar: {
          methods: ["stellar_signXDR"],
          chains: [chainId],
          events: [],
        },
      }

      try {
        const { uri, approval } = await client.connect({ requiredNamespaces })
        if (uri && onDisplayUri) {
          onDisplayUri(uri)
        }

        const session = await approval()
        const accounts = session.namespaces.stellar?.accounts || []
        const account = accounts.find((a: string) => a.startsWith(chainId + ":"))
        if (!account) {
          throw new WalletAdapterError(
            "wallet_network_mismatch",
            "Wallet did not approve the requested network."
          )
        }

        const address = account.split(":")[2]

        return {
          address,
          wallet: "walletconnect",
          network,
          networkPassphrase: getNetworkPassphrase(network) || "",
        }
      } catch (err) {
        const { message, code } = errorInfo(err)
        if (message?.includes("User rejected") || code === 5000) {
          throw new WalletAdapterError("wallet_access_rejected", "User rejected the connection.")
        }
        if (err instanceof WalletAdapterError) throw err
        throw new WalletAdapterError("wallet_unavailable", message || "Connection failed")
      }
    },

    async getNetworkDetails(network) {
      return {
        network,
        networkPassphrase: getNetworkPassphrase(network) || "",
      }
    },

    async resolveNetwork() {
      const client = await loadSignClient(projectId, metadata, storage)
      const sessions = client.session.values
      if (!sessions.length) throw new WalletAdapterError("wallet_unavailable", "No active session")

      const session = sessions[sessions.length - 1]
      const accounts = session.namespaces.stellar?.accounts || []
      if (!accounts.length)
        throw new WalletAdapterError("wallet_unavailable", "No stellar accounts found")

      const chainId = accounts[0].split(":")[0] + ":" + accounts[0].split(":")[1]
      const networkPassphrase = getPassphraseFromChainId(chainId)
      const networkId = resolveNetworkFromPassphrase(networkPassphrase)

      return {
        network: networkId,
        networkPassphrase,
      }
    },

    async canAutoConnect() {
      try {
        const client = await loadSignClient(projectId, metadata, storage)
        return client.session.values.length > 0
      } catch {
        return false
      }
    },

    subscribe(handler) {
      let client: SignClient | null = null
      let stopped = false

      const onSessionUpdate = (event: SessionUpdateEvent) => {
        if (stopped) return
        const accounts = event.params?.namespaces?.stellar?.accounts || []
        if (accounts.length > 0) {
          const chainId = accounts[0].split(":")[0] + ":" + accounts[0].split(":")[1]
          const address = accounts[0].split(":")[2]
          const networkPassphrase = getPassphraseFromChainId(chainId)
          handler({
            address,
            network: resolveNetworkFromPassphrase(networkPassphrase),
            networkPassphrase,
          })
        }
      }

      const onSessionDelete = () => {
        if (stopped) return
        handler({
          address: null,
          network: "custom",
          networkPassphrase: "",
        })
      }

      loadSignClient(projectId, metadata, storage)
        .then(c => {
          if (stopped) return
          client = c
          client.on("session_update", onSessionUpdate)
          client.on("session_delete", onSessionDelete)
        })
        .catch(() => {})

      return () => {
        stopped = true
        if (client) {
          client.removeListener("session_update", onSessionUpdate)
          client.removeListener("session_delete", onSessionDelete)
        }
      }
    },

    async signTransaction(xdr, options) {
      const client = await loadSignClient(projectId, metadata, storage)
      const sessions = client.session.values
      if (!sessions.length) throw new WalletAdapterError("wallet_unavailable", "No active session")

      const session = sessions[sessions.length - 1]

      const networkId = resolveNetworkFromPassphrase(options.networkPassphrase)
      const chainId = getStellarChainId(networkId)

      try {
        const response = await client.request({
          topic: session.topic,
          chainId,
          request: {
            method: "stellar_signXDR",
            params: { xdr },
          },
        })

        const signed = (response as { signedXDR?: unknown } | null)?.signedXDR
        if (typeof signed === "string" && signed) {
          return signed
        } else if (typeof response === "string") {
          return response
        }

        throw new Error("No signature returned")
      } catch (err) {
        const { message } = errorInfo(err)
        if (message?.includes("User rejected")) {
          throw new WalletAdapterError("wallet_access_rejected", "User rejected signing.")
        }
        throw new WalletAdapterError("wallet_sign_failed", message || "Signing failed")
      }
    },
  }
}
