import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
// From the module itself, not the "../cache" index, which re-exports the React `useQuery`.
import { liquidityPoolKey } from "../cache/keys"
import type { LiquidityPool, NetworkConfig } from "../types"

export { liquidityPoolKey }

/**
 * Fetches a single AMM liquidity pool by id from Horizon.
 *
 * Framework-neutral: the React `useLiquidityPool` hook and the Vue composable
 * both call this, so the two map the response and the errors identically.
 *
 * @throws {StellarError} mapped by `toStellarError` (e.g. `ACCOUNT_NOT_FOUND`
 *         for a 404, `RATE_LIMITED` for a 429). An abort rethrows the original
 *         error so the caller can ignore it.
 */
export async function fetchLiquidityPool(
  networkConfig: NetworkConfig,
  params: { poolId: string },
  options: { signal?: AbortSignal } = {}
): Promise<LiquidityPool> {
  try {
    const server = getHorizonServer(networkConfig)
    const res = await server.liquidityPools().liquidityPoolId(params.poolId).call()
    return toLiquidityPool(res)
  } catch (err) {
    if (options.signal?.aborted) throw err
    throw toStellarError(err) ?? err
  }
}

/** Maps a Horizon pool record onto the library's {@link LiquidityPool} shape. */
export function toLiquidityPool(res: {
  id: string
  fee_bp: number
  type: string
  total_trustlines: string
  total_shares: string
  reserves: { asset: string; amount: string }[]
}): LiquidityPool {
  return {
    id: res.id,
    fee_bp: res.fee_bp,
    type: res.type,
    total_trustlines: res.total_trustlines,
    total_shares: res.total_shares,
    reserves: res.reserves.map(reserve => ({ asset: reserve.asset, amount: reserve.amount })),
  }
}
