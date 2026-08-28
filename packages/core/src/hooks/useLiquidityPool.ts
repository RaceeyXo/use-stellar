import { useState, useCallback, useEffect } from "react";
import { useStellar } from "../providers/StellarProvider";
import { LiquidityPool, StellarError } from "../types";

export function useLiquidityPool(poolId: string) {
  const { server } = useStellar();
  const [pool, setPool] = useState<LiquidityPool | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StellarError | null>(null);

  const refetch = useCallback(async () => {
    if (!server || !poolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await server.liquidityPools().liquidityPoolId(poolId).call();
      setPool({
        id: res.id,
        fee_bp: res.fee_bp,
        type: res.type,
        total_trustlines: res.total_trustlines,
        total_shares: res.total_shares,
        reserves: res.reserves,
      });
    } catch (err) {
      setError(err as StellarError);
    } finally {
ts    }
  }, [server, poolId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { pool, loading, error, refetch };
}