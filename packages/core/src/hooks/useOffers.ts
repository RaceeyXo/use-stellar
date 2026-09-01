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
// packages/core/src/hooks/useOffers.ts

import { useCallback, useReducer } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { useQuery } from "../cache"
import type { UseOffersOptions, UseOffersReturn, NormalizedOffer, Asset, StellarError } from "../types"
import type { Horizon } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"

type OfferRecord = Horizon.ServerApi.OfferRecord

function normalizeAsset(assetType: string, assetCode?: string, assetIssuer?: string): Asset {
  return assetType === "native" ? "XLM" : { code: assetCode!, issuer: assetIssuer! }
}

function normalizeOffer(record: OfferRecord): NormalizedOffer {
  return {
    id: record.id.toString(),
    seller: record.seller,
    selling: normalizeAsset(record.selling.asset_type, record.selling.asset_code, record.selling.asset_issuer),
    buying: normalizeAsset(record.buying.asset_type, record.buying.asset_code, record.buying.asset_issuer),
    amount: record.amount,
    priceR: { n: record.price_r.n, d: record.price_r.d },
    price: record.price,
  }
}

interface PaginationState {
  queryKey: string
  offers: NormalizedOffer[] | null
  next: (() => Promise<Horizon.ServerApi.CollectionPage<OfferRecord>>) | null
  prev: (() => Promise<Horizon.ServerApi.CollectionPage<OfferRecord>>) | null
  hasNext: boolean | null
  hasPrev: boolean | null
  loading: boolean
  error: StellarError | null
}

type PaginationAction =
  | { type: "RESET"; queryKey: string }
  | { type: "FETCH_START"; queryKey: string }
  | {
      type: "FETCH_SUCCESS"
      queryKey: string
      offers: NormalizedOffer[]
      next: (() => Promise<Horizon.ServerApi.CollectionPage<OfferRecord>>) | null
      prev: (() => Promise<Horizon.ServerApi.CollectionPage<OfferRecord>>) | null
      hasNext: boolean
      hasPrev: boolean
    }
  | { type: "FETCH_ERROR"; queryKey: string; error: StellarError }

function paginationReducer(state: PaginationState, action: PaginationAction): PaginationState {
  switch (action.type) {
    case "RESET":
      return { queryKey: action.queryKey, offers: null, next: null, prev: null, hasNext: null, hasPrev: null, loading: false, error: null }
    case "FETCH_START":
      if (state.queryKey !== action.queryKey) return state
      return { ...state, loading: true, error: null }
    case "FETCH_SUCCESS":
      if (state.queryKey !== action.queryKey) return state
      return { ...state, loading: false, offers: action.offers, next: action.next, prev: action.prev, hasNext: action.hasNext, hasPrev: action.hasPrev }
    case "FETCH_ERROR":
      if (state.queryKey !== action.queryKey) return state
      return { ...state, loading: false, error: action.error, offers: [] }
    default:
      return state
  }
}

export function useOffers({ address, limit = 10, order = "desc", cursor }: UseOffersOptions = {}): UseOffersReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKeyArr = resolvedAddress
    ? ["offers", networkConfig.horizonUrl, network, resolvedAddress, limit, order, cursor]
    : ["offers", "disabled"]
  const currentQueryKey = JSON.stringify(queryKeyArr)

  const [pageState, dispatch] = useReducer(paginationReducer, {
    queryKey: currentQueryKey, offers: null, next: null, prev: null, hasNext: null, hasPrev: null, loading: false, error: null,
  })

  if (pageState.queryKey !== currentQueryKey) {
    dispatch({ type: "RESET", queryKey: currentQueryKey })
  }

  const { data, loading: cacheLoading, error: rawError, refetch } = useQuery({
    queryKey: queryKeyArr,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      if (!resolvedAddress) throw new Error("Address is required")

      let query = server.offers().forAccount(resolvedAddress).limit(limit).order(order)
      if (cursor) query = query.cursor(cursor)

      const res = await query.call()
      const normalized = res.records.map(normalizeOffer)

      dispatch({
        type: "FETCH_SUCCESS",
        queryKey: currentQueryKey,
        offers: normalized,
        next: res.records.length > 0 ? () => res.next() : null,
        prev: res.records.length > 0 ? () => res.prev() : null,
        hasNext: res.records.length >= limit,
        hasPrev: !!cursor,
      })

      return { offers: normalized, hasNext: res.records.length >= limit, hasPrev: !!cursor }
    },
    store: queryStore,
    enabled: Boolean(resolvedAddress),
  })

  const fetchNext = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.next) return
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.next()
      const normalized = res.records.map(normalizeOffer)
      dispatch({
        type: "FETCH_SUCCESS", queryKey: currentQueryKey, offers: normalized,
        next: res.records.length > 0 ? () => res.next() : null,
        prev: res.records.length > 0 ? () => res.prev() : null,
        hasNext: res.records.length >= limit, hasPrev: true,
      })
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", queryKey: currentQueryKey, error: toStellarError(err) })
    }
  }, [pageState.queryKey, pageState.next, currentQueryKey, limit])

  const fetchPrev = useCallback(async () => {
    if (pageState.queryKey !== currentQueryKey || !pageState.prev) return
    dispatch({ type: "FETCH_START", queryKey: currentQueryKey })
    try {
      const res = await pageState.prev()
      const normalized = res.records.map(normalizeOffer)
      dispatch({
        type: "FETCH_SUCCESS", queryKey: currentQueryKey, offers: normalized,
        next: res.records.length > 0 ? () => res.next() : null,
        prev: res.records.length > 0 ? () => res.prev() : null,
        hasNext: true, hasPrev: res.records.length >= limit,
      })
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", queryKey: currentQueryKey, error: toStellarError(err) })
    }
  }, [pageState.queryKey, pageState.prev, currentQueryKey, limit])

  const error = pageState.error ?? (rawError ? toStellarError(rawError) : null)
  const loading = pageState.loading || cacheLoading

  return {
    offers: pageState.offers ?? data?.offers ?? [],
    loading, error, refetch, fetchNext, fetchPrev,
    hasNext: pageState.hasNext ?? data?.hasNext ?? false,
    hasPrev: pageState.hasPrev ?? data?.hasPrev ?? false,
  }
}