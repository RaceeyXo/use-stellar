import type { StellarNetwork, WalletType } from "../types"
import type { WalletAdapter } from "./types"
import { WalletAdapterError } from "./types"
import { albedoAdapter } from "./albedoAdapter"
import { getNetworkPassphrase } from "../types"
import { freighterAdapter } from "./freighterAdapter"

function createUnsupportedAdapter(type: WalletType, name: string): WalletAdapter {
  const createError = () =>
    new WalletAdapterError("wallet_unsupported", `${name} is not supported yet.`)

  return {
    metadata: {
      type,
      name,
      supported: false,
    },
    async isAvailable() {
      return false
    },
    async connect() {
      throw createError()
    },
    async getNetworkDetails(network: StellarNetwork) {
      return {
        network,
        networkPassphrase: getNetworkPassphrase(network) ?? "",
      }
    },
    async signTransaction() {
      throw createError()
    },
  }
}

const WALLET_ADAPTERS: Record<string, WalletAdapter> = {
  freighter: freighterAdapter,
  albedo: albedoAdapter,
  lobstr: createUnsupportedAdapter("lobstr", "LOBSTR"),
  rabet: createUnsupportedAdapter("rabet", "Rabet"),
}

/** Options accepted by {@link registerWalletAdapter}. */
export interface RegisterWalletAdapterOptions {
  /**
   * Replace an adapter that is already registered under the same
   * `metadata.type`. Defaults to `false` so two libraries cannot silently
   * fight over the same key.
   */
  override?: boolean
}

/**
 * Registers a wallet adapter so `connect()` can use it, keyed by
 * `adapter.metadata.type`.
 *
 * Applications and wallet vendors can ship their own adapter without a change
 * to this package. Re-registering an existing type is refused unless
 * `{ override: true }` is passed — otherwise the loser of the race fails at
 * runtime with a confusing error.
 *
 * @param adapter - The adapter to register.
 * @param options - Pass `{ override: true }` to intentionally replace an
 *                  already-registered adapter.
 * @throws {WalletAdapterError} `wallet_unsupported` when the adapter is
 *         malformed, or when the type is taken and `override` is not set.
 *
 * @example
 * registerWalletAdapter(myAdapter)
 * await connect("my-wallet")
 */
export function registerWalletAdapter(
  adapter: WalletAdapter,
  options: RegisterWalletAdapterOptions = {}
): void {
  const type = adapter?.metadata?.type

  if (!type || typeof type !== "string") {
    throw new WalletAdapterError(
      "wallet_unsupported",
      "Cannot register a wallet adapter without a `metadata.type` string."
    )
  }

  if (typeof adapter.connect !== "function" || typeof adapter.signTransaction !== "function") {
    throw new WalletAdapterError(
      "wallet_unsupported",
      `Wallet adapter "${type}" must implement connect() and signTransaction().`
    )
  }

  if (WALLET_ADAPTERS[type] && !options.override) {
    throw new WalletAdapterError(
      "wallet_unsupported",
      `A wallet adapter is already registered for "${type}". ` +
        "Pass { override: true } if replacing it is intentional."
    )
  }

  WALLET_ADAPTERS[type] = adapter
}

/**
 * Looks up the adapter for a wallet type.
 *
 * @param walletType - A built-in type, or any type registered with
 *                     {@link registerWalletAdapter}.
 * @throws {WalletAdapterError} `wallet_unsupported` when nothing is registered
 *         for the type. It never returns `undefined` — a stored or
 *         JavaScript-supplied value that is not a known wallet must fail with a
 *         real error rather than a `TypeError` at the first property access.
 */
export function getWalletAdapter(walletType: WalletType): WalletAdapter {
  const adapter = WALLET_ADAPTERS[walletType as string]

  if (!adapter) {
    throw new WalletAdapterError(
      "wallet_unsupported",
      `Unknown wallet type "${String(walletType)}". ` +
        `Known wallets: ${Object.keys(WALLET_ADAPTERS).join(", ")}. ` +
        "Register a custom adapter with registerWalletAdapter()."
    )
  }

  return adapter
}

/** Returns `true` when an adapter is registered for `walletType`. */
export function hasWalletAdapter(walletType: string): boolean {
  return Boolean(WALLET_ADAPTERS[walletType])
}

export function getWalletAdapters(): WalletAdapter[] {
  return Object.values(WALLET_ADAPTERS)
}
