import type { StellarNetwork, WalletNetworkId } from "../types"
import { NETWORK_PASSPHRASES } from "../types"
import type { WalletAdapter, WalletNetworkState, WalletNetworkDetails } from "./types"
import { WalletAdapterError } from "./types"

export const FREIGHTER_WALLET_TYPE = "freighter" as const

export { NETWORK_PASSPHRASES }

/** How often (ms) the Freighter watcher polls the extension for changes. */
const WATCH_INTERVAL = 3_000

/** The subset of `@stellar/freighter-api` this adapter uses. */
interface FreighterApi {
  getNetworkDetails: () => Promise<{
    network: string
    networkUrl: string
    networkPassphrase: string
    error?: { message: string }
  }>
  isConnected: () => Promise<{ isConnected: boolean; error?: { message: string } }>
  isAllowed: () => Promise<{ isAllowed: boolean; error?: { message: string } }>
  requestAccess: () => Promise<{ address: string; error?: { message: string } }>
  signTransaction: (
    xdr: string,
    options: { networkPassphrase: string; address: string }
  ) => Promise<{ signedTxXdr: string; error?: { message: string } }>
  WatchWalletChanges: new (interval: number) => {
    watch: (
      cb: (params: {
        address: string
        network: string
        networkPassphrase: string
        error?: { message: string }
      }) => void
    ) => { error?: { message: string } }
    stop: () => void
  }
}

let freighterPromise: Promise<FreighterApi> | null = null
let freighterResolved: FreighterApi | null = null

/**
 * Loads `@stellar/freighter-api` lazily and caches it.
 *
 * Freighter is an optional peer dependency — a consumer who only uses another
 * wallet should not have to install it. The dynamic import also keeps the SDK
 * out of the SSR bundle: as a real deferred module it is not inlined into the
 * build output, so a security fix in Freighter's API can be applied by the
 * application without a release of this library.
 *
 * When the package is missing, the import rejects with a module resolution
 * error, which is surfaced as a typed `wallet_unavailable` naming the package
 * to install — never as an unhandled rejection or a raw bundler error.
 */
async function loadFreighter(): Promise<FreighterApi> {
  if (freighterResolved) return freighterResolved
  if (!freighterPromise) {
    freighterPromise = (async () => {
      try {
        const mod = (await import("@stellar/freighter-api")) as unknown as FreighterApi
        freighterResolved = mod
        return mod
      } catch {
        throw new WalletAdapterError(
          "wallet_unavailable",
          'Package "@stellar/freighter-api" is not installed. ' +
            "Install it to use the Freighter wallet: npm install @stellar/freighter-api"
        )
      }
    })()
  }
  return freighterPromise
}

/**
 * Maps a network passphrase onto a known network.
 *
 * Driven by the shared {@link NETWORK_PASSPHRASES} table rather than a ladder
 * of string literals, so adding a network is one entry in one place.
 *
 * An unrecognised passphrase is a private or standalone network — it is
 * reported as `"custom"`, never thrown on, so a wallet pointed at a local
 * quickstart node stays usable.
 */
export function resolveNetworkFromPassphrase(passphrase: string): WalletNetworkId {
  const match = (Object.keys(NETWORK_PASSPHRASES) as (keyof typeof NETWORK_PASSPHRASES)[]).find(
    network => NETWORK_PASSPHRASES[network] === passphrase
  )

  return match ?? "custom"
}

async function getFreighterNetworkDetails(_network: StellarNetwork): Promise<WalletNetworkDetails> {
  const freighter = await loadFreighter()
  const details = await freighter.getNetworkDetails()
  if (details.error) {
    throw new WalletAdapterError("wallet_access_rejected", details.error.message)
  }

  return {
    network: resolveNetworkFromPassphrase(details.networkPassphrase),
    networkPassphrase: details.networkPassphrase,
  }
}

export const freighterAdapter: WalletAdapter = {
  metadata: {
    type: FREIGHTER_WALLET_TYPE,
    name: "Freighter",
    supported: true,
  },

  async isAvailable() {
    const freighter = await loadFreighter()
    const connection = await freighter.isConnected()
    return Boolean(connection.isConnected && !connection.error)
  },

  async connect(network) {
    const freighter = await loadFreighter()
    const connection = await freighter.isConnected()
    if (connection.error || !connection.isConnected) {
      throw new WalletAdapterError(
        "wallet_unavailable",
        "Freighter wallet not found. Install the Freighter browser extension and try again."
      )
    }

    const access = await freighter.requestAccess()
    if (access.error) {
      throw new WalletAdapterError("wallet_access_rejected", access.error.message)
    }

    if (!access.address) {
      throw new WalletAdapterError(
        "wallet_access_rejected",
        "Freighter did not return a wallet address."
      )
    }

    const networkDetails = await getFreighterNetworkDetails(network)

    return {
      address: access.address,
      wallet: FREIGHTER_WALLET_TYPE,
      ...networkDetails,
    }
  },

  getNetworkDetails: getFreighterNetworkDetails,

  async resolveNetwork(): Promise<WalletNetworkState> {
    const freighter = await loadFreighter()
    const details = await freighter.getNetworkDetails()
    if (details.error) {
      throw new WalletAdapterError("wallet_access_rejected", details.error.message)
    }

    return {
      network: resolveNetworkFromPassphrase(details.networkPassphrase),
      networkPassphrase: details.networkPassphrase,
    }
  },

  async canAutoConnect() {
    // `isAllowed` answers "has this origin already been approved?" without
    // raising a dialog. Only then can connect() complete silently.
    const freighter = await loadFreighter()
    const connection = await freighter.isConnected()
    if (connection.error || !connection.isConnected) return false

    const allowed = await freighter.isAllowed()
    return Boolean(allowed.isAllowed && !allowed.error)
  },

  subscribe(handler) {
    // The adapter contract is synchronous (`subscribe` returns an
    // unsubscribe). Freighter loads asynchronously, but by the time `subscribe`
    // runs the module has already been loaded by a successful `connect()` —
    // so build the watcher synchronously from the cached module. Only when the
    // module is not loaded yet (defensive) do we fall back to awaiting it.
    let watcher: {
      watch: (
        cb: (params: {
          address: string
          network: string
          networkPassphrase: string
          error?: { message: string }
        }) => void
      ) => { error?: { message: string } }
      stop: () => void
    } | null = null
    let stopped = false

    const startWatch = (mod: FreighterApi) => {
      if (stopped) return
      watcher = new mod.WatchWalletChanges(WATCH_INTERVAL)

      watcher.watch(({ address, networkPassphrase, error }) => {
        // A transient extension error (locked wallet, revoked access) is not a
        // change worth reporting — the next tick reports the real state.
        if (error) return

        handler({
          address: address || null,
          network: resolveNetworkFromPassphrase(networkPassphrase),
          networkPassphrase,
        })
      })
    }

    if (freighterResolved) {
      startWatch(freighterResolved)
    } else {
      void loadFreighter()
        .then(startWatch)
        .catch(() => {
          // The optional peer is missing. `connect` already surfaced
          // `wallet_unavailable`, so there is nothing to watch — and nothing
          // to report synchronously through `subscribe`'s contract.
        })
    }

    return () => {
      stopped = true
      watcher?.stop()
    }
  },

  async signTransaction(xdr, options) {
    const freighter = await loadFreighter()
    const signedTransaction = await freighter.signTransaction(xdr, {
      networkPassphrase: options.networkPassphrase,
      address: options.address,
    })

    if (signedTransaction.error) {
      throw new WalletAdapterError("wallet_sign_failed", signedTransaction.error.message)
    }

    if (!signedTransaction.signedTxXdr) {
      throw new WalletAdapterError(
        "wallet_sign_failed",
        "Freighter did not return a signed transaction."
      )
    }

    return signedTransaction.signedTxXdr
  },
}
