import { useCallback, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { useQuery } from "../cache"
import { tradesKey } from "../cache/keys"
import { fetchTradesPage, assetToKey, normalizeTrade } from "../queries/trades"
import type { StellarError } from "../types"
import type { NormalizedTrade, UseTradesOptions, UseTradesReturn } from "../types"
import type { Horizon } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"

type TradeRecord = Horizon.ServerApi.TradeRecord

interface PageData {
  trades: NormalizedTrade[]
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Fetches executed trades (fills) from Horizon with pagination.
 *
 * Filter by account, asset pair, or both. Each trade is normalized so that the
 * base asset always corresponds to the `baseAsset`  you requested (when
 * filtering by asset pair), with the price rational inverted when Horizon
 * returns the pair in the opposite orientation. See the **Base/counter
 * orientation** note below.
 *
 * ## Base/counter orientation
 *
 * Horizon orders the base and counter assets by Stellar's canonical asset
 * ordering, which is independent of how you queried. If you filter by
 * `{ baseAsset: "XLM", counterAsset: { code: "USDC", issuer: "G..." } }` but
 * Horizon returns the record with USDC as base, this hook flips base and
 * counter and inverts the price rational so every record is consistently
 * oriented with XLM as base. When no `baseAsset` is supplied the hook uses
 * Horizon's canonical orientation unchanged.
 *
 * ## Liquidity-pool trades
 *
 * Liquidity-pool trades are returned by Horizon's `/trades` endpoint alongside
 * orderbook trades. This hook returns them without filtering — all records in
 * the response are included. If you need only one trade type, inspect
 * `trade.tradeType` in the normalized record.
 *
 * ## Pagination
 *
 * Cursors are driven by the Horizon `next()` / `prev()` functions returned with
 * each page, which embed the correct paging token. Stale cursor refs are
 * cleared whenever the query parameters change, so navigating to a new account
 * or asset pair always starts from page one.
 *
 * @example
 * // By account
 * const { trades, fetchNext } = useTrades({ address: "G..." })
 *
 * @example
 * // By asset pair
 * const { trades } = useTrades({
 *   baseAsset: "XLM",
 *   counterAsset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335XKKX3IHOJAPP5RE34K4KZVN" },
 * })
 */
export function useTrades({
  address,
  baseAsset,
  counterAsset,
  limit = 10,
  order = "desc",
}: UseTradesOptions = {}): UseTradesReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  // Memoize asset identity on primitive values, not object references.
  const baseAssetKey = assetToKey(baseAsset)
  const counterAssetKey = assetToKey(counterAsset)

  // At least one filter must be provided; otherwise the query is disabled.
  const enabled = Boolean(resolvedAddress) || Boolean(baseAsset)

  const queryKey = enabled
    ? tradesKey(
        networkConfig.horizonUrl,
        network,
        resolvedAddress ?? "",
        baseAssetKey,
        counterAssetKey,
        limit,
        order
      )
    : (["trades", "disabled"] as const)

  // Store page navigation functions from the Horizon response.
  const nextRef = useRef<(() => Promise<Horizon.ServerApi.CollectionPage<TradeRecord>>) | null>(
    null
  )
  const prevRef = useRef<(() => Promise<Horizon.ServerApi.CollectionPage<TradeRecord>>) | null>(
    null
  )

  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState<StellarError | null>(null)
  const [pageTrades, setPageTrades] = useState<NormalizedTrade[] | null>(null)
  const [pageHasNext, setPageHasNext] = useState<boolean | null>(null)
  const [pageHasPrev, setPageHasPrev] = useState<boolean | null>(null)

  const {
    data,
    loading: cacheLoading,
    error: rawError,
    refetch,
  } = useQuery<PageData>({
    queryKey,
    queryFn: async () => {
      const page = await fetchTradesPage(networkConfig, {
        address: resolvedAddress,
        baseAsset,
        counterAsset,
        limit,
        order,
      })

      nextRef.current = page.nextCursor
      prevRef.current = page.prevCursor

      return {
        trades: page.records,
        hasNext: page.hasNext,
        hasPrev: page.hasPrev,
      }
    },
    store: queryStore,
    enabled,
  })

  // Reset page overrides whenever the base query parameters change.
  const keyStr = JSON.stringify(queryKey)
  const prevKeyRef = useRef(keyStr)
  if (prevKeyRef.current !== keyStr) {
    prevKeyRef.current = keyStr
    // Clear stale cursor refs immediately on parameter change.
    nextRef.current = null
    prevRef.current = null
    setPageTrades(null)
    setPageHasNext(null)
    setPageHasPrev(null)
    setPageError(null)
  }

  const fetchNext = useCallback(async () => {
    if (!nextRef.current) return
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await nextRef.current()
      const normalized = res.records.map(rec =>
        normalizeTrade(rec, resolvedAddress ?? null, baseAsset ?? null)
      )
      setPageTrades(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(res.records.length >= limit)
      setPageHasPrev(true)
    } catch (err) {
      setPageTrades([])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAddress, baseAssetKey, counterAssetKey, limit])

  const fetchPrev = useCallback(async () => {
    if (!prevRef.current) return
    setPageLoading(true)
    setPageError(null)
    try {
      const res = await prevRef.current()
      const normalized = res.records.map(rec =>
        normalizeTrade(rec, resolvedAddress ?? null, baseAsset ?? null)
      )
      setPageTrades(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setPageHasNext(true)
      setPageHasPrev(res.records.length >= limit)
    } catch (err) {
      setPageTrades([])
      setPageError(toStellarError(err))
    } finally {
      setPageLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAddress, baseAssetKey, counterAssetKey, limit])

  const error = pageError ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageLoading || cacheLoading

  return {
    trades: pageTrades ?? data?.trades ?? [],
    loading,
    error,
    refetch,
    fetchNext,
    fetchPrev,
    hasNext: pageHasNext ?? data?.hasNext ?? false,
    hasPrev: pageHasPrev ?? data?.hasPrev ?? false,
  }
}
