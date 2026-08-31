import type { StellarNetwork, WalletNetworkId, WalletType } from "../types"

export type WalletAdapterErrorCode =
  | "wallet_unavailable"
  | "wallet_unsupported"
  | "wallet_access_rejected"
  | "wallet_network_mismatch"
  | "wallet_sign_failed"

export class WalletAdapterError extends Error {
  constructor(
    public readonly code: WalletAdapterErrorCode,
    message: string
  ) {
    super(message)
    this.name = "WalletAdapterError"
  }
}

export interface WalletAdapterMetadata {
  type: WalletType
  name: string
  supported: boolean
}

export interface WalletNetworkDetails {
  network: StellarNetwork
  networkPassphrase: string
}

export interface WalletConnection extends WalletNetworkDetails {
  address: string
  wallet: WalletType
}

export interface SignTransactionOptions extends WalletNetworkDetails {
  address: string
}

/**
 * The network a wallet reports it is actually on, right now.
 *
 * Unlike {@link WalletNetworkDetails} this is descriptive, not prescriptive:
 * it never throws on a passphrase the SDK does not recognise, it reports it as
 * `network: "custom"` so a private or standalone network is a value the UI can
 * render rather than an error that breaks the hook.
 */
export interface WalletNetworkState {
  network: WalletNetworkId
  networkPassphrase: string
}

/**
 * A change the wallet reported about itself — the user switched account or
 * network inside the extension.
 *
 * `address` is `null` when the wallet reported a change it could not attribute
 * to an account (for example after the user locked the extension).
 */
export interface WalletChange {
  address: string | null
  network: WalletNetworkId
  networkPassphrase: string
}

export interface WalletAdapter {
  metadata: WalletAdapterMetadata
  isAvailable: () => Promise<boolean>
  connect: (network: StellarNetwork) => Promise<WalletConnection>
  disconnect?: () => void | Promise<void>
  getNetworkDetails: (network: StellarNetwork) => Promise<WalletNetworkDetails>
  signTransaction: (xdr: string, options: SignTransactionOptions) => Promise<string>
  /**
   * Reports the network the wallet is currently on without asserting it is the
   * one the app asked for, and without prompting the user.
   *
   * Adapters that cannot answer this (Albedo confirms the network per-request
   * rather than exposing a current one) simply omit it.
   */
  resolveNetwork?: () => Promise<WalletNetworkState>
  /**
   * Reports whether the wallet can reconnect silently — the app is already
   * approved, so `connect()` will not raise an approval dialog.
   *
   * Used by autoconnect: when this returns `false`, the session is restored as
   * intent only (the wallet is pre-selected) rather than as a connection.
   * Adapters that always prompt omit it, which is read as "would prompt".
   */
  canAutoConnect?: () => Promise<boolean>
  /**
   * Subscribes to the wallet's own change notifications — account switches and
   * network switches made inside the extension.
   *
   * Returns an unsubscribe function. Adapters that cannot report changes omit
   * this entirely; nothing in the hooks branches on wallet type.
   */
  subscribe?: (handler: (change: WalletChange) => void) => () => void
}
