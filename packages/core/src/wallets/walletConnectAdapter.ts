/* eslint-disable */
import type { StellarNetwork, WalletNetworkId } from "../types"
import { NETWORK_PASSPHRASES, getNetworkPassphrase } from "../types"
import type { WalletAdapter } from "./types"
import { WalletAdapterError } from "./types"
import { readWalletSession, writeWalletSession } from "../runtime/walletSession"
import type { PersistedWalletSession } from "../runtime/walletSession"

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
        // Optional peer dependency: it may or may not be installed where this
        // is compiled, so the module is typed here rather than by its own
        // declarations (`@ts-ignore`, not `@ts-expect-error`, for that reason).
        // The specifier stays a literal so bundlers can resolve it.
        // @ts-ignore
        const { SignClient } = (await import("@walletconnect/sign-client")) as unknown as {
          SignClient: { init: (options: Record<string, unknown>) => Promise<unknown> }
        }
        const client = await SignClient.init({
          projectId,
          metadata,
          storage,
        })
        signClientResolved = client as unknown as SignClient
        return client as unknown as SignClient
      } catch {
        // Do not cache the failure: a relay hiccup during init would otherwise
        // break WalletConnect until the page is reloaded.
        signClientPromise = null
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

/** CAIP-10 accounts (`stellar:<chain>:<address>`) a session approved. */
function getSessionAccounts(session: SessionStruct): string[] {
  return session.namespaces.stellar?.accounts || []
}

/**
 * The newest session that approved an account on `chainId` — optionally a
 * specific `address`. Sessions from earlier pairings can linger in the client's
 * storage, so "the last one" is not necessarily the one the app is using.
 */
function findSession(
  client: SignClient,
  chainId: string,
  address?: string
): { session: SessionStruct; address: string } | null {
  const sessions = client.session.values
  for (let i = sessions.length - 1; i >= 0; i--) {
    const account = getSessionAccounts(sessions[i]).find(
      a => a.startsWith(chainId + ":") && (!address || a.split(":")[2] === address)
    )
    if (account) return { session: sessions[i], address: account.split(":")[2] }
  }
  return null
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
  /**
   * The wallet session storage kind ("local", "session", or custom adapter).
   * Used to persist and restore WalletConnect sessions across page reloads.
   * Defaults to "local".
   */
  sessionStorage?: "local" | "session" | unknown
}

export function createWalletConnectAdapter({
  projectId,
  metadata,
  storage,
  onDisplayUri,
  sessionStorage = "local",
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

      // An approved session for this network is reused, not re-paired. This is
      // what makes `canAutoConnect()` true: restoring a session must not put a
      // QR code / wallet prompt in front of the user on every page load.
      const existing = findSession(client, chainId)
      if (existing) {
        const session: PersistedWalletSession = {
          wallet: "walletconnect",
          address: existing.address,
          chain: chainId,
        }
        await writeWalletSession(sessionStorage, session)
        return {
          address: existing.address,
          wallet: "walletconnect",
          network,
          networkPassphrase: getNetworkPassphrase(network) || "",
        }
      }

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

        // Persist the session
        const persistedSession: PersistedWalletSession = {
          wallet: "walletconnect",
          address,
          chain: chainId,
        }
        await writeWalletSession(sessionStorage, persistedSession)

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

    async disconnect() {
      // Only an already-loaded client can hold sessions; never load the SDK
      // just to disconnect.
      const client = signClientResolved
      if (!client) {
        // Even if no client is loaded, clear the stored session to ensure
        // clean state. This handles the case where the app crashed and the
        // stored session was left behind.
        await writeWalletSession(sessionStorage, null)
        return
      }

      // End all WalletConnect sessions, then clear the stored session.
      // Errors in disconnecting remote sessions don't prevent clearing local state.
      try {
        await Promise.all(
          client.session.values
            .filter(session => getSessionAccounts(session).length > 0)
            .map(session =>
              client
                .disconnect({
                  topic: session.topic,
                  reason: { code: 6000, message: "User disconnected." },
                })
                .catch(() => {})
            )
        )
      } finally {
        // Always clear the stored session, even if remote disconnect failed.
        await writeWalletSession(sessionStorage, null)
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
        // Check if there's a valid session. A valid session is one where:
        // 1. At least one session exists
        // 2. That session hasn't been reported as deleted by WalletConnect
        // Note: WalletConnect doesn't expose expiry timestamps to clients, so we
        // trust WalletConnect to manage session lifecycle. If a session is stale,
        // signing will fail and the app will handle the error.
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

          // Update the persisted session to stay in sync with WalletConnect
          const persistedSession: PersistedWalletSession = {
            wallet: "walletconnect",
            address,
            chain: chainId,
          }
          void writeWalletSession(sessionStorage, persistedSession)

          handler({
            address,
            network: resolveNetworkFromPassphrase(networkPassphrase),
            networkPassphrase,
          })
        }
      }

      const onSessionDelete = () => {
        if (stopped) return

        // Clear the stored session first, then notify the handler.
        // This ensures the app sees a clean disconnected state.
        void writeWalletSession(sessionStorage, null).then(() => {
          if (!stopped) {
            handler({
              address: null,
              network: "custom",
              networkPassphrase: "",
              disconnected: true,
            })
          }
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

      const networkId = resolveNetworkFromPassphrase(options.networkPassphrase)
      const chainId = getStellarChainId(networkId)

      // Sign with the session that approved this account on this network, not
      // whichever session happens to be newest.
      const match = findSession(client, chainId, options.address)
      if (!match) {
        throw new WalletAdapterError(
          "wallet_network_mismatch",
          "No WalletConnect session has approved this account on the requested network."
        )
      }
      const session = match.session

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
