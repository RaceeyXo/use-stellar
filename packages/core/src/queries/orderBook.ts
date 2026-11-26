import { Asset as StellarAsset } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import { getHorizonServer, isIssuedAsset, isNativeAsset } from "../utils"
import type { Asset, NetworkConfig, OrderbookEntry } from "../types"

export interface OrderBookResult {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  spread: string | null
  midPrice: string | null
  lastUpdated: Date
}

export const orderBookKey = (
  horizonUrl: string,
  network: string,
  selling: Asset,
  buying: Asset,
  limit: number
) => ["orderbook", horizonUrl, network, assetIdentity(selling), assetIdentity(buying), limit] as const

function assetIdentity(asset: Asset): string {
  return isIssuedAsset(asset) ? `${asset.code}:${asset.issuer}` : asset
}

function toAsset(asset: Asset): StellarAsset {
  if (isNativeAsset(asset)) return StellarAsset.native()
  if (!isIssuedAsset(asset)) {
    throw createStellarError("VALIDATION_ERROR", "Order books require XLM or an issued asset")
  }
  return new StellarAsset(asset.code, asset.issuer)
}

function decimal(n: bigint, d: bigint, places = 7): string {
  if (d === 0n) return "0"
  const scaled = (n * 10n ** BigInt(places)) / d
  const negative = scaled < 0n
  const value = (negative ? -scaled : scaled).toString().padStart(places + 1, "0")
  const fraction = value.slice(-places).replace(/0+$/, "")
  return `${negative ? "-" : ""}${value.slice(0, -places) || "0"}${fraction ? `.${fraction}` : ""}`
}

export async function fetchOrderBook(
  networkConfig: NetworkConfig,
  params: { selling: Asset; buying: Asset; limit?: number }
): Promise<OrderBookResult> {
  try {
    const response = await getHorizonServer(networkConfig)
      .orderbook(toAsset(params.selling), toAsset(params.buying))
      .limit(params.limit ?? 20)
      .call()
    const map = (record: { price: string; amount: string; price_r: { n: number; d: number } }) => ({
      price: record.price,
      amount: record.amount,
      priceR: { n: record.price_r.n, d: record.price_r.d },
    })
    const bids = response.bids.map(map)
    const asks = response.asks.map(map)
    let spread: string | null = null
    let midPrice: string | null = null
    if (bids[0] && asks[0]) {
      const bid = bids[0].priceR
      const ask = asks[0].priceR
      const bn = BigInt(bid.n), bd = BigInt(bid.d), an = BigInt(ask.n), ad = BigInt(ask.d)
      spread = decimal(an * bd - bn * ad, ad * bd)
      midPrice = decimal(bn * ad + an * bd, 2n * bd * ad)
    }
    return { bids, asks, spread, midPrice, lastUpdated: new Date() }
  } catch (cause) {
    throw toStellarError(cause) ?? cause
  }
}
