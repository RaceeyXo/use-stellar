import { Horizon } from "@stellar/stellar-sdk"
import type { Asset, Balance, NetworkConfig, StellarNetwork, IssuedAsset } from "../types"
import { NETWORK_CONFIGS } from "../types"

// ── Environment helpers ───────────────────────────────────────────────────
/** Returns `true` only when running in a browser (not Node / SSR). */
export function isBrowser(): boolean {
  return typeof window !== "undefined"
}

/**
 * How long (seconds) a built transaction stays valid when the provider does not
 * say otherwise. Short on purpose: in a browser the wallet prompt is on the
 * same screen, and a transaction that can still land minutes later is a
 * transaction the user may have given up on. A native app, where signing means
 * switching to another app and back, sets a longer bound on its provider.
 */
export const DEFAULT_TRANSACTION_TIMEOUT = 30

// Note: prefer runtime.platform.canConnectWallet over isBrowser()
// for environment checks inside hooks. isBrowser() is kept for
// public compatibility and simple DOM checks.
/**
 * Returns `true` when running inside React Native (Hermes/JSC), matching the
 * detection already used by the wallet adapters (`registry.ts`,
 * `freighterAdapter.ts`, `albedoAdapter.ts`).
 *
 * React Native has no `window`, so `isBrowser()` alone cannot tell "no DOM
 * because this is a server" apart from "no DOM because this is a native app".
 * Transaction signing needs the second distinction: it is unsupported during
 * SSR (there is no client to hold a wallet session) but fully supported on
 * native, where the WalletConnect adapter does the signing.
 */
export function isReactNative(): boolean {
  return typeof navigator !== "undefined" && navigator.product === "ReactNative"
}

/**
 * Returns `true` when transaction signing can run in the current environment:
 * a browser, or React Native. `false` only during SSR/Node, where there is no
 * client-side wallet session to sign with.
 */
export function canSignTransactions(): boolean {
  return isBrowser() || isReactNative()
}

// ── Network helpers ────────────────────────────────────────────────────────
/**
 * Returns the built-in config for a network.
 *
 * @throws {Error} for `"custom"`, which by definition has no built-in config —
 *         its endpoints and passphrase come from the provider's
 *         `networkConfig`. Read `networkConfig` from context instead.
 */
export function getNetworkConfig(network: StellarNetwork): NetworkConfig {
  if (network === "custom") {
    throw new Error(
      'use-stellar: there is no built-in config for network="custom". ' +
        "Read `networkConfig` from the Stellar context instead."
    )
  }
  return NETWORK_CONFIGS[network]
}

/**
 * Builds a Horizon server for a network, or for an already-resolved config.
 *
 * Pass the resolved `networkConfig` from context wherever you have it: it is
 * the only form that works for a custom network, and it honours a custom
 * `horizonUrl`.
 */
export function getHorizonServer(config: NetworkConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  })
}

// ── Asset helpers ──────────────────────────────────────────────────────────
export function isNativeAsset(asset: Asset): asset is "XLM" {
  return asset === "XLM"
}

export function isIssuedAsset(asset: Asset | unknown): asset is IssuedAsset {
  return (
    typeof asset === "object" &&
    asset !== null &&
    "code" in asset &&
    typeof asset.code === "string" &&
    asset.code.trim().length > 0 &&
    "issuer" in asset &&
    typeof asset.issuer === "string" &&
    asset.issuer.trim().length > 0
  )
}

/**
 * Narrows to the pool-share pseudo-asset.
 *
 * Pool shares appear in balances but cannot be sent, traded, or used as either
 * side of an offer, so the paths that build operations need to reject them
 * explicitly rather than fall through to the issued-asset branch.
 */
export function isLiquidityPoolShares(asset: Asset): asset is "liquidity_pool_shares" {
  return asset === "liquidity_pool_shares"
}

export function formatAssetCode(asset: Asset): string {
  if (isNativeAsset(asset)) return "XLM"
  if (isIssuedAsset(asset)) return asset.code
  return asset // "liquidity_pool_shares"
}

/**
 * Validates whether an asset code follows Stellar naming conventions.
 *
 * @param code - The asset code to validate
 * @returns True if the code is valid (1-12 alphanumeric characters), false otherwise
 */
export function isValidAssetCode(code: string): boolean {
  return /^[a-zA-Z0-9]{1,12}$/.test(code)
}

/**
 * Parses a raw Horizon balance line into a standard Balance object.
 *
 * @param raw - The raw balance line from Horizon API.
 * @returns The parsed Balance object.
 */
export function parseHorizonBalance(raw: Horizon.HorizonApi.BalanceLine): Balance {
  if (raw.asset_type === "native") {
    return {
      asset: "XLM",
      balance: raw.balance,
    }
  }

  if (raw.asset_type === "liquidity_pool_shares") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lp = raw as any
    return {
      asset: "liquidity_pool_shares",
      balance: lp.balance,
      liquidityPoolId: lp.liquidity_pool_id,
    } as Balance
  }

  const issued = raw as Horizon.HorizonApi.BalanceLineAsset
  return {
    asset: {
      code: issued.asset_code,
      issuer: issued.asset_issuer,
    },
    balance: issued.balance,
    limit: issued.limit,
  }
}

// ── Address helpers ────────────────────────────────────────────────────────
/**
 * Validates whether a string is a valid Stellar public key address.
 *
 * @param address - The address to validate
 * @returns True if the address is a valid Stellar address, false otherwise
 */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address)
}

export function shortenAddress(address: string, chars = 6): string {
  if (!address) return ""
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

// ── Amount helpers ─────────────────────────────────────────────────────────
/**
 * Formats a decimal amount without converting it to a floating-point number.
 *
 * Fractional digits beyond `decimals` are truncated rather than rounded so
 * formatting never increases the amount's magnitude.
 *
 * @param amount - A plain decimal string, optionally prefixed with `-`.
 * @param decimals - The maximum number of fractional digits to preserve.
 * @returns The formatted amount, or `"0"` when the input is invalid.
 */
export function formatAmount(amount: string, decimals = 7): string {
  if (!/^-?\d+(\.\d+)?$/.test(amount)) return "0"

  const [integerPart, fractionPart = ""] = amount.split(".")
  const fraction = fractionPart.padEnd(decimals, "0").slice(0, decimals).replace(/0+$/, "")

  const isZero = /^-?0+$/.test(integerPart) && fraction.length === 0
  if (isZero) return "0"

  return fraction ? `${integerPart}.${fraction}` : integerPart
}
