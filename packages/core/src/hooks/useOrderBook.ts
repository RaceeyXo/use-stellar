import { useEffect } from "react"
import { useQuery } from "../cache"
import { useStellarContext } from "../context/StellarProvider"
import { fetchOrderBook, orderBookKey } from "../queries/orderBook"
import type { StellarError, UseOrderbookOptions, UseOrderbookReturn } from "../types"

export function useOrderbook({ selling, buying, limit = 20, watch = false, interval = 5000, enabled = true }: UseOrderbookOptions): UseOrderbookReturn {
  const { network, networkConfig, queryStore } = useStellarContext()
  const query = useQuery({
    queryKey: orderBookKey(networkConfig.horizonUrl, network, selling, buying, limit),
    queryFn: () => fetchOrderBook(networkConfig, { selling, buying, limit }),
    store: queryStore,
    enabled,
  })
  useEffect(() => {
    if (!watch || !enabled) return
    const timer = setInterval(query.refetch, interval)
    return () => clearInterval(timer)
  }, [watch, enabled, interval, query.refetch])
  return {
    bids: query.data?.bids ?? [], asks: query.data?.asks ?? [],
    spread: query.data?.spread ?? null, midPrice: query.data?.midPrice ?? null,
    loading: query.loading, error: query.error as StellarError | null,
    lastUpdated: query.data?.lastUpdated ?? null, refetch: query.refetch,
  }
}
