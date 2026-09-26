// packages/vue/src/horizon.ts
//
// Small Horizon helpers, kept local to this package for the reason `types.ts`
// documents: importing them from `use-stellar` (React) would drag in a
// required `react` peer dependency for every Vue user.

import { Horizon } from "@stellar/stellar-sdk"
import type { Balance, NetworkConfig } from "./types"

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
