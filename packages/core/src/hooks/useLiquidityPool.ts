import { useState, useCallback, useEffect } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import type { LiquidityPool, StellarError } from "../types"

/**
 * Fetches a single AMM liquidity pool by id.
 *
 * @example
 * const { pool, loading, error } = useLiquidityPool(poolId)
 */
export function useLiquidityPool(poolId: string) {
  const { networkConfig } = useStellarContext()
  const [pool, setPool] = useState<LiquidityPool | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  const refetch = useCallback(async () => {
    if (!poolId) return
    setLoading(true)
    setError(null)
    try {
      const server = getHorizonServer(networkConfig)
      const res = await server.liquidityPools().liquidityPoolId(poolId).call()
      setPool({
        id: res.id,
        fee_bp: res.fee_bp,
        type: res.type,
        total_trustlines: res.total_trustlines,
        total_shares: res.total_shares,
        reserves: res.reserves,
      })
    } catch (err) {
      setError(toStellarError(err))
    } finally {
      setLoading(false)
    }
  }, [networkConfig, poolId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { pool, loading, error, refetch }
}
