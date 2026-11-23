import { useStellarContext } from "../context/StellarProvider"
import { toStellarError } from "../errors"
import { useQuery } from "../cache"
import { fetchLiquidityPool, liquidityPoolKey } from "../queries/liquidityPool"
import type { LiquidityPool, StellarError } from "../types"

export interface UseLiquidityPoolOptions {
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

/**
 * Fetches a single AMM liquidity pool by id.
 *
 * A thin React adapter over the framework-neutral {@link fetchLiquidityPool}
 * query, which owns the request, the response mapping and the error mapping.
 * Results are cached in the shared QueryStore under {@link liquidityPoolKey},
 * so hooks asking for the same pool share one request — as the Vue composable does.
 *
 * @example
 * const { pool, loading, error } = useLiquidityPool(poolId)
 */
export function useLiquidityPool(poolId: string, options: UseLiquidityPoolOptions = {}) {
  const { network, networkConfig, queryStore } = useStellarContext()
  const id = poolId?.trim() || null

  const {
    data,
    loading,
    error: rawError,
    refetch,
  } = useQuery<LiquidityPool>({
    queryKey: id
      ? liquidityPoolKey(networkConfig.horizonUrl, network, id)
      : (["liquidityPool", "disabled"] as const),
    queryFn: () => fetchLiquidityPool(networkConfig, { poolId: id! }),
    store: queryStore,
    staleTime: options.staleTime,
    enabled: id !== null,
    maxRetries: options.maxRetries,
  })

  const pool: LiquidityPool | null = data ?? null
  const error: StellarError | null = rawError ? toStellarError(rawError) : null
  return { pool, loading, error, refetch }
}
