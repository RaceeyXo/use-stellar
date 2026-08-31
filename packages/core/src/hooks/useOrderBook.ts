// packages/core/src/hooks/useOrderbook.ts

import { useState, useCallback, useEffect, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { Asset as StellarAsset } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"
import type { UseOrderbookReturn, UseOrderbookOptions, OrderbookEntry, Asset, StellarError } from "../types"

// Converts BigInt rational (n/d) to a precise decimal string
function formatRational(n: bigint, d: bigint, decimals = 7): string {
  if (d === 0n) return "0"
  const multiplier = 10n ** BigInt(decimals)
  const scaled = (n * multiplier) / d
  const isNegative = scaled < 0n
  const absValue = isNegative ? -scaled : scaled
  
  const strValue = absValue.toString().padStart(decimals + 1, "0")
  const intPart = strValue.slice(0, -decimals) || "0"
  const fracPart = strValue.slice(-decimals).replace(/0+$/, "")
  
  const sign = isNegative ? "-" : ""
  return fracPart ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`
}

function toStellarAsset(asset: Asset): StellarAsset {
  return asset === "XLM" ? StellarAsset.native() : new StellarAsset(asset.code, asset.issuer)
}

export function useOrderbook({
  selling,
  buying,
  limit = 20,
  watch = false,
  interval = 5000,
  enabled = true
}: UseOrderbookOptions): UseOrderbookReturn {
  const { networkConfig } = useStellarContext()
  const [bids, setBids] = useState<OrderbookEntry[]>([])
  const [asks, setAsks] = useState<OrderbookEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const mounted = useRef(true)
  const fetchCount = useRef(0)

  // Memoize assets using primitives to prevent infinite loops from inline objects
  const sellingKey = selling === "XLM" ? "native" : `${selling.code}:${selling.issuer}`
  const buyingKey = buying === "XLM" ? "native" : `${buying.code}:${buying.issuer}`

  const fetchOrderbook = useCallback(async () => {
    if (!enabled) return

    const currentFetchId = ++fetchCount.current
    if (bids.length === 0 && asks.length === 0) setLoading(true)

    try {
      const server = getHorizonServer(networkConfig)
      const sellingAsset = toStellarAsset(selling)
      const buyingAsset = toStellarAsset(buying)

      const response = await server
        .orderbook(sellingAsset, buyingAsset)
        .limit(limit)
        .call()

      // Guard out-of-order responses and unmounts
      if (!mounted.current || currentFetchId !== fetchCount.current) return

      const mapEntry = (record: any): OrderbookEntry => ({
        price: record.price,
        amount: record.amount,
        priceR: { n: record.price_r.n, d: record.price_r.d }
      })

      setBids(response.bids.map(mapEntry))
      setAsks(response.asks.map(mapEntry))
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      if (!mounted.current || currentFetchId !== fetchCount.current) return
      setError(toStellarError(e))
    } finally {
      if (mounted.current && currentFetchId === fetchCount.current) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkConfig, sellingKey, buyingKey, limit, enabled])

  useEffect(() => {
    mounted.current = true
    fetchOrderbook()

    let intervalId: ReturnType<typeof setInterval>
    if (watch && enabled) {
      intervalId = setInterval(fetchOrderbook, interval)
    }

    return () => {
      mounted.current = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [fetchOrderbook, watch, interval, enabled])

  // Derive exact spread and mid price strictly using BigInt rationals
  let spread: string | null = null
  let midPrice: string | null = null

  if (bids.length > 0 && asks.length > 0) {
    const highestBid = bids[0].priceR
    const lowestAsk = asks[0].priceR

    const n1 = BigInt(highestBid.n)
    const d1 = BigInt(highestBid.d)
    const n2 = BigInt(lowestAsk.n)
    const d2 = BigInt(lowestAsk.d)

    // Spread = ask - bid = (n2*d1 - n1*d2) / (d1*d2)
    const spreadN = n2 * d1 - n1 * d2
    const commonD = d1 * d2
    spread = formatRational(spreadN, commonD)

    // MidPrice = (ask + bid) / 2 = (n1*d2 + n2*d1) / (2*d1*d2)
    const midN = n1 * d2 + n2 * d1
    const midD = 2n * d1 * d2
    midPrice = formatRational(midN, midD)
  }

  return { bids, asks, spread, midPrice, loading, error, lastUpdated, refetch: fetchOrderbook }
}