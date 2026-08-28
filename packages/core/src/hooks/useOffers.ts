import { useState, useCallback, useEffect, useRef } from "react"
import { useStellar } from "../providers/StellarProvider"
import { StellarError, Offer, UseOffersOptions, UseOffersReturn } from "../types"

export function useOffers({
  address,
  limit = 10,
  cursor,
  order = "desc",
}: UseOffersOptions = {}): UseOffersReturn {
  const { server, publicKey } = useStellar()
  const targetAddress = address || publicKey

  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [hasNext, setHasNext] = useState(false)
  
  const currentCursor = useRef<string | undefined>(cursor)

  const fetchOffers = useCallback(
    async (isNext = false) => {
      if (!server || !targetAddress) return

      setLoading(true)
      setError(null)

      try {
        let callBuilder = server.offers().forAccount(targetAddress).limit(limit).order(order)

        if (isNext && currentCursor.current) {
          callBuilder = callBuilder.cursor(currentCursor.current)
        } else if (!isNext && cursor) {
          callBuilder = callBuilder.cursor(cursor)
        }

        const res = await callBuilder.call()
        const records: Offer[] = res.records.map((r) => ({
          id: r.id.toString(),
          seller: r.seller,
          selling:
            r.selling.asset_type === "native"
              ? "XLM"
              : { code: r.selling.asset_code!, issuer: r.selling.asset_issuer! },
          buying:
            r.buying.asset_type === "native"
              ? "XLM"
              : { code: r.buying.asset_code!, issuer: r.buying.asset_issuer! },
          amount: r.amount,
          price: r.price,
          price_r: r.price_r,
          lastModifiedLedger: r.last_modified_ledger,
          lastModifiedTime: r.last_modified_time,
        }))

        setOffers((prev) => (isNext ? [...prev, ...records] : records))
        setHasNext(records.length === limit)

        if (records.length > 0) {
          currentCursor.current = records[records.length - 1].paging_token
        }
      } catch (err: any) {
        setError(err as StellarError)
      } finally {
        setLoading(false)
      }
    },
    [server, targetAddress, limit, order, cursor]
  )

  useEffect(() => {
    currentCursor.current = cursor
    fetchOffers(false)
  }, [server, targetAddress, limit, order, cursor, fetchOffers])

  const fetchNext = async () => {
    if (!hasNext || loading) return
    await fetchOffers(true)
  }

  const refetch = async () => {
    currentCursor.current = cursor
    await fetchOffers(false)
  }

  return { offers, loading, error, hasNext, fetchNext, refetch }
}