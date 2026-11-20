import { StrKey } from "@stellar/stellar-sdk"
import { accountKey } from "../cache/keys"
import { createStellarError, toStellarError } from "../errors"
import type { NetworkConfig, StellarNetwork, WalletState } from "../types"

export interface FriendbotRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  queryStore: { invalidate: (key: readonly unknown[]) => void }
}

export async function fundWithFriendbot(runtime: FriendbotRuntime, address?: string): Promise<void> {
  if (runtime.network === "mainnet") throw createStellarError("VALIDATION_ERROR", "Friendbot is not available on mainnet.")
  const target = address ?? runtime.wallet.address
  if (!target) throw createStellarError("WALLET_NOT_CONNECTED", "No address provided and wallet is not connected.")
  if (!StrKey.isValidEd25519PublicKey(target)) throw createStellarError("VALIDATION_ERROR", "Invalid destination address. Must be a valid Ed25519 public key (starts with G).")
  const endpoint = runtime.network === "testnet" ? "https://friendbot.stellar.org" : runtime.network === "futurenet" ? "https://friendbot-futurenet.stellar.org" : null
  if (!endpoint) throw createStellarError("VALIDATION_ERROR", `Friendbot is not supported on the ${runtime.network} network.`)
  try {
    const response = await fetch(`${endpoint}?addr=${encodeURIComponent(target)}`)
    if (!response.ok) {
      if (response.status === 400) throw createStellarError("ALREADY_FUNDED", "Account already exists and is funded.")
      throw new Error(`Friendbot failed with status ${response.status}: ${response.statusText}`)
    }
    runtime.queryStore.invalidate(accountKey(runtime.networkConfig.horizonUrl, runtime.network, target))
  } catch (cause) {
    throw toStellarError(cause) ?? cause
  }
}
