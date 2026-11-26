import type { Horizon } from "@stellar/stellar-sdk"
import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import type { Asset, NetworkConfig, NormalizedOffer } from "../types"

type OfferRecord = Horizon.ServerApi.OfferRecord

export interface OffersPageResult {
  offers: NormalizedOffer[]
  next: () => Promise<Horizon.ServerApi.CollectionPage<OfferRecord>>
  prev: () => Promise<Horizon.ServerApi.CollectionPage<OfferRecord>>
  hasNext: boolean
  hasPrev: boolean
}

export const offersKey = (
  horizonUrl: string,
  network: string,
  address: string,
  limit: number,
  order: "asc" | "desc",
  cursor?: string
) => ["offers", horizonUrl, network, address, limit, order, cursor] as const

function asset(type: string, code?: string, issuer?: string): Asset {
  return type === "native" ? "XLM" : { code: code!, issuer: issuer! }
}

export function normalizeOffer(record: OfferRecord): NormalizedOffer {
  return {
    id: String(record.id),
    seller: record.seller,
    selling: asset(record.selling.asset_type, record.selling.asset_code, record.selling.asset_issuer),
    buying: asset(record.buying.asset_type, record.buying.asset_code, record.buying.asset_issuer),
    amount: record.amount,
    priceR: { n: record.price_r.n, d: record.price_r.d },
    price: record.price,
  }
}

export async function fetchOffersPage(
  networkConfig: NetworkConfig,
  params: { address: string; limit?: number; order?: "asc" | "desc"; cursor?: string }
): Promise<OffersPageResult> {
  const limit = params.limit ?? 10
  try {
    let request = getHorizonServer(networkConfig)
      .offers()
      .forAccount(params.address)
      .limit(limit)
      .order(params.order ?? "desc")
    if (params.cursor) request = request.cursor(params.cursor)
    const page = await request.call()
    return {
      offers: page.records.map(normalizeOffer),
      next: () => page.next(),
      prev: () => page.prev(),
      hasNext: page.records.length >= limit,
      hasPrev: Boolean(params.cursor),
    }
  } catch (cause) {
    throw toStellarError(cause) ?? cause
  }
}
