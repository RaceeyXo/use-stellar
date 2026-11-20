import type { AutoConnectOptions, StellarNetwork } from "../types"
import type { WalletAdapter } from "./types"
import { WalletAdapterError } from "./types"
import { getNetworkPassphrase } from "../types"
import { getWalletSessionStorage, WALLET_SESSION_STORAGE_KEY } from "../runtime/walletSession"
import type { WalletSessionStorage } from "../runtime/walletSession"
import { createWalletConnectAdapter } from "./walletConnectAdapter"
import type { CreateWalletConnectAdapterOptions } from "./walletConnectAdapter"

/** The wallet type LOBSTR registers under. */
export const LOBSTR_WALLET_TYPE = "lobstr"

/** LOBSTR's WalletConnect deep-link scheme. */
export const LOBSTR_DEEP_LINK_BASE = "lobstr://wc"

/** Where to get a WalletConnect project ID. */
const PROJECT_ID_HELP =
  "Create a project ID at https://cloud.reown.com, then call " +
  "configureLobstrAdapter({ projectId: '...' }) once at startup " +
  "(on React Native, configureReactNativeLobstrAdapter)."

/** Options for {@link createLobstrAdapter} and {@link configureLobstrAdapter}. */
export interface LobstrAdapterOptions {
  /** WalletConnect Cloud project ID belonging to the application. Required. */
  projectId: string
  /** App metadata LOBSTR shows when asking the user to approve the pairing. */
  metadata?: CreateWalletConnectAdapterOptions["metadata"]
  /** WalletConnect key/value storage; see {@link CreateWalletConnectAdapterOptions}. */
  storage?: unknown
  /** Where the connected session is remembered. Defaults to `"local"`. */
  sessionStorage?: AutoConnectOptions["storage"]
  /**
   * Receives the pairing URI (`wc:...`). On the web, render it as a QR code.
   * Called before {@link openWallet}.
   */
  onDisplayUri?: (uri: string) => void
  /**
   * Opens the LOBSTR app for a pairing URI. Receives the LOBSTR deep link
   * (see {@link getLobstrDeepLink}). The React Native entry supplies one that
   * uses `Linking`; the web has none, so the QR flow is used there.
   */
  openWallet?: (deepLink: string) => void | Promise<void>
}

/** Builds the LOBSTR deep link that opens the app on a WalletConnect pairing URI. */
export function getLobstrDeepLink(uri: string): string {
  return `${LOBSTR_DEEP_LINK_BASE}?uri=${encodeURIComponent(uri)}`
}

/**
 * Wraps a session storage so the WalletConnect adapter's `"walletconnect"`
 * session is persisted as `"lobstr"`. Without it a restored session would name
 * a wallet type that is not registered, and auto-connect would silently skip.
 */
function relabelSessionStorage(kind: AutoConnectOptions["storage"]): AutoConnectOptions["storage"] {
  const target: WalletSessionStorage | null = getWalletSessionStorage(kind)
  if (!target) return kind
  return {
    getItem: key => target.getItem(key),
    removeItem: key => target.removeItem(key),
    setItem(key, value) {
      if (key === WALLET_SESSION_STORAGE_KEY) {
        try {
          const parsed = JSON.parse(value) as Record<string, unknown>
          if (parsed && typeof parsed === "object" && parsed.wallet === "walletconnect") {
            return target.setItem(key, JSON.stringify({ ...parsed, wallet: LOBSTR_WALLET_TYPE }))
          }
        } catch {
          // Not our JSON to rewrite; store it unchanged.
        }
      }
      return target.setItem(key, value)
    },
  }
}

const DEFAULT_METADATA: NonNullable<LobstrAdapterOptions["metadata"]> = {
  name: "use-stellar app",
  description: "A Stellar application built with use-stellar",
  url: "https://github.com/RaceeyXo/use-stellar",
  icons: [],
}

/**
 * Creates a LOBSTR adapter: the WalletConnect adapter with LOBSTR's identity
 * and deep link. It is a preset, not a second protocol implementation.
 *
 * @throws {WalletAdapterError} `wallet_unavailable` when `projectId` is empty,
 *         with the steps to configure one.
 */
export function createLobstrAdapter(options: LobstrAdapterOptions): WalletAdapter {
  if (typeof options?.projectId !== "string" || !options.projectId.trim()) {
    throw new WalletAdapterError(
      "wallet_unavailable",
      `LOBSTR needs a WalletConnect project ID. ${PROJECT_ID_HELP}`
    )
  }

  const {
    projectId,
    metadata,
    storage,
    sessionStorage = "local",
    onDisplayUri,
    openWallet,
  } = options

  const inner = createWalletConnectAdapter({
    projectId,
    metadata: metadata ?? DEFAULT_METADATA,
    storage,
    sessionStorage: relabelSessionStorage(sessionStorage),
    onDisplayUri: uri => {
      onDisplayUri?.(uri)
      if (openWallet) {
        // A rejected deep link (LOBSTR not installed) leaves the QR fallback.
        void Promise.resolve()
          .then(() => openWallet(getLobstrDeepLink(uri)))
          .catch(() => undefined)
      }
    },
  })

  return {
    ...inner,
    metadata: {
      type: LOBSTR_WALLET_TYPE,
      name: "LOBSTR",
      supported: true,
      platforms: ["web", "native"],
    },
    async connect(network) {
      const connection = await inner.connect(network)
      return { ...connection, wallet: LOBSTR_WALLET_TYPE }
    },
  }
}

let configured: WalletAdapter | null = null

/**
 * Enables LOBSTR for `connect("lobstr")`. Call once at startup, before the
 * first connect. Calling it again replaces the earlier configuration.
 *
 * @throws {WalletAdapterError} `wallet_unavailable` when `projectId` is empty.
 *
 * @example
 * configureLobstrAdapter({
 *   projectId: "<your WalletConnect project ID>",
 *   metadata: { name: "My app", description: "...", url: "https://myapp.example", icons: [] },
 *   onDisplayUri: uri => showQrCode(uri),
 * })
 * await connect("lobstr")
 */
export function configureLobstrAdapter(options: LobstrAdapterOptions): void {
  configured = createLobstrAdapter(options)
}

/** Clears the configuration. For tests. @internal */
export function resetLobstrAdapter(): void {
  configured = null
}

function requireConfigured(): WalletAdapter {
  if (!configured) {
    throw new WalletAdapterError(
      "wallet_unavailable",
      `LOBSTR is not configured: it connects through WalletConnect and needs a project ID. ${PROJECT_ID_HELP}`
    )
  }
  return configured
}

/**
 * The adapter registered as `"lobstr"`. It delegates to the adapter built by
 * {@link configureLobstrAdapter}; until then every connection attempt fails
 * with a `wallet_unavailable` error that says how to configure one.
 */
export const lobstrAdapter: WalletAdapter = {
  metadata: {
    type: LOBSTR_WALLET_TYPE,
    name: "LOBSTR",
    supported: true,
    platforms: ["web", "native"],
  },
  async isAvailable() {
    return configured ? configured.isAvailable() : false
  },
  async connect(network) {
    return requireConfigured().connect(network)
  },
  async disconnect() {
    await configured?.disconnect?.()
  },
  async getNetworkDetails(network: StellarNetwork) {
    return configured
      ? configured.getNetworkDetails(network)
      : { network, networkPassphrase: getNetworkPassphrase(network) ?? "" }
  },
  async signTransaction(xdr, options) {
    return requireConfigured().signTransaction(xdr, options)
  },
  async resolveNetwork() {
    const adapter = requireConfigured()
    if (!adapter.resolveNetwork) {
      throw new WalletAdapterError("wallet_unsupported", "LOBSTR cannot report its network.")
    }
    return adapter.resolveNetwork()
  },
  canAutoConnect: async network => configured?.canAutoConnect?.(network) ?? false,
  subscribe: handler => configured?.subscribe?.(handler) ?? (() => undefined),
}
