import { useCallback, useRef, useState } from "react"
import { Asset as StellarAsset } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { useQuery } from "../cache"
import { tradesKey } from "../cache/keys"
import type { Asset, StellarError } from "../types"
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
 * base asset always corresponds to the `baseAsset` you requested (when
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
 *   counterAsset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
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
      const server = getHorizonServer(networkConfig)
      let query = server.trades().limit(limit).order(order)

      if (resolvedAddress) {
        query = query.forAccount(resolvedAddress)
      }

      if (baseAsset && counterAsset) {
        const sdkBase = assetToSdkAsset(baseAsset)
        const sdkCounter = assetToSdkAsset(counterAsset)
        query = query.forAssetPair(sdkBase, sdkCounter)
      }

      const res = await query.call()

      const normalized = res.records.map(rec =>
        normalizeTrade(rec, resolvedAddress ?? null, baseAsset ?? null)
      )

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      return {
        trades: normalized,
        hasNext: res.records.length >= limit,
        hasPrev: false,
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

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert an `Asset` value to a stable string key for memoization.
 * Object references are not stable across renders; primitives are.
 */
function assetToKey(asset: Asset | undefined | null): string {
  if (!asset) return ""
  if (asset === "XLM") return "XLM"
  return `${asset.code}:${asset.issuer}`
}

/**
 * Convert a use-stellar `Asset` to the `@stellar/stellar-sdk` `Asset` class
 * required by `TradesCallBuilder#forAssetPair`.
 */
function assetToSdkAsset(asset: Asset): StellarAsset {
  if (asset === "XLM") return StellarAsset.native()
  return new StellarAsset(asset.code, asset.issuer)
}

/**
 * Parse a raw Horizon asset into a use-stellar `Asset`.
 */
function parseAsset(type: string, code?: string, issuer?: string): Asset {
  if (type === "native") return "XLM"
  return { code: code ?? "", issuer: issuer ?? "" }
}

/**
 * Compare two assets for equality.
 */
function assetEquals(a: Asset, b: Asset): boolean {
  if (a === "XLM" && b === "XLM") return true
  if (a === "XLM" || b === "XLM") return false
  return a.code === b.code && a.issuer === b.issuer
}

/**
 * Compute a precise decimal price string from the rational n/d.
 * Uses string arithmetic to avoid any floating-point imprecision.
 *
 * @param n - Numerator as a string (from Horizon)
 * @param d - Denominator as a string (from Horizon)
 * @returns Decimal string with up to 7 significant fractional digits.
 */
function rationalToDecimal(n: string, d: string): string {
  const numerator = BigInt(n)
  const denominator = BigInt(d)
  if (denominator === 0n) return "0"

  // Compute integer and remainder parts, then express up to 7 decimal places
  // using integer arithmetic only — no floating-point anywhere.
  const SCALE = 10_000_000n // 7 decimal places (Stellar's native precision)
  const scaled = (numerator * SCALE) / denominator
  const intPart = scaled / SCALE
  const fracPart = scaled % SCALE

  const fracStr = fracPart.toString().padStart(7, "0").replace(/0+$/, "")
  if (fracStr === "") return intPart.toString()
  return `${intPart}.${fracStr}`
}

/**
 * Normalize a raw Horizon TradeRecord into a NormalizedTrade.
 *
 * **Orientation rule:** when a `requestedBase` is supplied (i.e., the caller
 * asked for a specific asset pair), the hook ensures that `baseAsset` in the
 * result always matches the requested base. If Horizon returned the record with
 * the pair flipped, the hook swaps base/counter and inverts the price rational
 * (new_n = old_d, new_d = old_n) so that the price is always expressed as
 * `counterAmount / baseAmount` in the caller's frame of reference.
 *
 * When no `requestedBase` is supplied (account-only filter), the canonical
 * Horizon orientation is preserved.
 */
function normalizeTrade(
  record: TradeRecord,
  accountAddress: string | null,
  requestedBase: Asset | null
): NormalizedTrade {
  const rawBase = parseAsset(
    record.base_asset_type,
    record.base_asset_code,
    record.base_asset_issuer
  )
  const rawCounter = parseAsset(
    record.counter_asset_type,
    record.counter_asset_code,
    record.counter_asset_issuer
  )

  // Default price rational from Horizon (n and d are strings in SDK 12.x).
  const rawN = record.price?.n ?? "1"
  const rawD = record.price?.d ?? "1"

  // Decide whether to flip the pair.
  // Flip when the caller specified a baseAsset and Horizon returned it as counter.
  const shouldFlip =
    requestedBase !== null &&
    !assetEquals(rawBase, requestedBase) &&
    assetEquals(rawCounter, requestedBase)

  const baseAsset = shouldFlip ? rawCounter : rawBase
  const counterAsset = shouldFlip ? rawBase : rawCounter
  const baseAmount = shouldFlip ? record.counter_amount : record.base_amount
  const counterAmount = shouldFlip ? record.base_amount : record.counter_amount

  // Invert the price rational when flipping: if price was counter/base, it
  // becomes base/counter in the new orientation.
  const priceN = shouldFlip ? rawD : rawN
  const priceD = shouldFlip ? rawN : rawD

  const priceR = { n: Number(priceN), d: Number(priceD) }
  const price = rationalToDecimal(priceN, priceD)

  // Derive 'side' for account-filtered queries.
  // base_is_seller = true  → the base account is selling the base asset.
  // If the queried account is the base account (seller), their side is "sell".
  // If the queried account is the counter account, their side is "buy".
  let side: "buy" | "sell" | undefined
  if (accountAddress) {
    const isBaseAccount =
      "base_account" in record &&
      record.base_account !== undefined &&
      record.base_account === accountAddress

    const isCounterAccount =
      "counter_account" in record &&
      record.counter_account !== undefined &&
      record.counter_account === accountAddress

    if (isBaseAccount) {
      // base_is_seller: base account sells base asset → side is "sell"
      side = record.base_is_seller ? "sell" : "buy"
    } else if (isCounterAccount) {
      // The counter account is on the opposite side
      side = record.base_is_seller ? "buy" : "sell"
    }
  }

  return {
    id: record.id,
    ledgerCloseTime: record.ledger_close_time,
    tradeType: record.trade_type,
    baseAsset,
    baseAmount,
    counterAsset,
    counterAmount,
    priceR,
    price,
    baseIsSeller: record.base_is_seller,
    side,
  }
}
