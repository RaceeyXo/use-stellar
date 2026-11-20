import { useCallback, useEffect, useState } from "react"
import { useQuery } from "../cache"
import { useStellarContext } from "../context/StellarProvider"
import { fetchOffersPage, normalizeOffer, offersKey, type OffersPageResult } from "../queries/offers"
import { toStellarError } from "../errors"
import type { NormalizedOffer, StellarError, UseOffersOptions, UseOffersReturn } from "../types"

export function useOffers({ address, limit = 10, order = "desc", cursor }: UseOffersOptions = {}): UseOffersReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address
  const query = useQuery<OffersPageResult>({
    queryKey: resolvedAddress ? offersKey(networkConfig.horizonUrl, network, resolvedAddress, limit, order, cursor) : ["offers", "disabled"],
    queryFn: () => fetchOffersPage(networkConfig, { address: resolvedAddress!, limit, order, cursor }),
    store: queryStore,
    enabled: Boolean(resolvedAddress),
  })
  const [offers, setOffers] = useState<NormalizedOffer[]>([])
  const [page, setPage] = useState<OffersPageResult | null>(null)
  const [pageError, setPageError] = useState<StellarError | null>(null)
  const [pageLoading, setPageLoading] = useState(false)
  useEffect(() => { setPage(query.data); setOffers(query.data?.offers ?? []); setPageError(null) }, [query.data])
  const navigate = useCallback(async (direction: "next" | "prev") => {
    if (!page) return
    setPageLoading(true)
    try {
      const response = await page[direction]()
      const nextOffers = response.records.map(normalizeOffer)
      setOffers(nextOffers)
      setPage({ offers: nextOffers, next: () => response.next(), prev: () => response.prev(), hasNext: direction === "next" ? response.records.length >= limit : true, hasPrev: direction === "prev" ? response.records.length >= limit : true })
      setPageError(null)
    } catch (cause) { setPageError(toStellarError(cause)) }
    finally { setPageLoading(false) }
  }, [page, limit])
  return { offers, loading: query.loading || pageLoading, error: pageError ?? (query.error as StellarError | null), refetch: query.refetch, fetchNext: () => navigate("next"), fetchPrev: () => navigate("prev"), hasNext: page?.hasNext ?? false, hasPrev: page?.hasPrev ?? false }
}
