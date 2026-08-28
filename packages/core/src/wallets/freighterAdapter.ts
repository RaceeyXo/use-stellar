import {
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api"
import type { StellarNetwork, WalletNetworkId } from "../types"
import { NETWORK_PASSPHRASES } from "../types"
import type { WalletAdapter, WalletNetworkState, WalletNetworkDetails } from "./types"
import { WalletAdapterError } from "./types"

export const FREIGHTER_WALLET_TYPE = "freighter" as const

export { NETWORK_PASSPHRASES }

/** How often (ms) the Freighter watcher polls the extension for changes. */
const WATCH_INTERVAL = 3_000

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

/**
 * The passphrase a wallet is expected to report for a network.
 *
 * A `"custom"` network has no known passphrase — the adapter cannot assert
 * what the wallet should be on, so it accepts whatever the wallet reports and
 * leaves the mismatch check to the provider's resolved config.
 */
function getExpectedPassphrase(network: StellarNetwork): string | null {
  return network === "custom" ? null : NETWORK_PASSPHRASES[network]
}

async function getFreighterNetworkDetails(network: StellarNetwork): Promise<WalletNetworkDetails> {
  const details = await getNetworkDetails()
  if (details.error) {
    throw new WalletAdapterError("wallet_access_rejected", details.error.message)
  }

  const expectedPassphrase = getExpectedPassphrase(network)
  if (expectedPassphrase !== null && details.networkPassphrase !== expectedPassphrase) {
    throw new WalletAdapterError(
      "wallet_network_mismatch",
      `Wrong network. Switch Freighter to ${network} and try again.`
    )
  }

  return {
    network,
    networkPassphrase: expectedPassphrase ?? details.networkPassphrase,
  }
}

export const freighterAdapter: WalletAdapter = {
  metadata: {
    type: FREIGHTER_WALLET_TYPE,
    name: "Freighter",
    supported: true,
  },

  async isAvailable() {
    const connection = await isConnected()
    return Boolean(connection.isConnected && !connection.error)
  },

  async connect(network) {
    const connection = await isConnected()
    if (connection.error || !connection.isConnected) {
      throw new WalletAdapterError(
        "wallet_unavailable",
        "Freighter wallet not found. Install the Freighter browser extension and try again."
      )
    }

    const access = await requestAccess()
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
    const details = await getNetworkDetails()
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
    const connection = await isConnected()
    if (connection.error || !connection.isConnected) return false

    const allowed = await isAllowed()
    return Boolean(allowed.isAllowed && !allowed.error)
  },

  subscribe(handler) {
    const watcher = new WatchWalletChanges(WATCH_INTERVAL)

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

    return () => watcher.stop()
  },

  async signTransaction(xdr, options) {
    const signedTransaction = await signTransaction(xdr, {
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
