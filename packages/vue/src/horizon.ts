// packages/vue/src/horizon.ts
//
// Small Horizon helpers, kept local to this package for the reason `types.ts`
// documents: importing them from `use-stellar` (React) would drag in a
// required `react` peer dependency for every Vue user.

import { Horizon } from "@stellar/stellar-sdk"
import type { Balance, NetworkConfig } from "./types"

export type AdapterErrorCode =
  "ACCOUNT_NOT_FOUND" | "RATE_LIMITED" | "WALLET_REQUEST_REJECTED" | "NETWORK_ERROR" | "UNKNOWN"

export interface AdapterError extends Error {
  readonly code: AdapterErrorCode
  readonly raw: unknown
}

function classifiedError(code: AdapterErrorCode, raw: unknown): AdapterError {
  const message = raw instanceof Error ? raw.message : String(raw)
  return Object.assign(new Error(message), { name: "StellarError", code, raw })
}

/** Normalizes shared Horizon and wallet failures without importing React. */
export function normalizeAdapterError(error: unknown): AdapterError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      name?: unknown
      code?: unknown
      response?: { status?: number; data?: { status?: number; type?: string } }
    }
    if (candidate.name === "WalletAdapterError" && candidate.code === "wallet_access_rejected") {
      return classifiedError("WALLET_REQUEST_REJECTED", error)
    }

    const status = candidate.response?.status ?? candidate.response?.data?.status
    const type = candidate.response?.data?.type
    if (status === 404 || type?.endsWith("/not_found")) {
      return classifiedError("ACCOUNT_NOT_FOUND", error)
    }
    if (status === 429 || type?.endsWith("/rate_limit_exceeded")) {
      return classifiedError("RATE_LIMITED", error)
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes("network") || message.includes("failed to fetch")) {
    return classifiedError("NETWORK_ERROR", error)
  }
  return classifiedError("UNKNOWN", error)
}

export function getHorizonServer(config: NetworkConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  })
}

export function parseHorizonBalance(raw: Horizon.HorizonApi.BalanceLine): Balance {
  if (raw.asset_type === "native") {
    return { asset: "XLM", balance: raw.balance }
  }

  if (raw.asset_type === "liquidity_pool_shares") {
    const lp = raw as unknown as { balance: string; liquidity_pool_id: string }
    return {
      asset: "liquidity_pool_shares",
      balance: lp.balance,
      liquidityPoolId: lp.liquidity_pool_id,
    }
  }

  const issued = raw as Horizon.HorizonApi.BalanceLineAsset
  return {
    asset: { code: issued.asset_code, issuer: issued.asset_issuer },
    balance: issued.balance,
    limit: issued.limit,
  }
}
