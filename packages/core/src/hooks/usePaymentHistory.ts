// packages/core/src/hooks/usePaymentHistory.ts

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { usePayments } from "./usePayments"
import type { UsePaymentHistoryOptions, UsePaymentHistoryReturn, NormalizedPayment } from "../types"

export function usePaymentHistory({
  address,
  limit = 10,
  order = "desc",
  cursor,
  direction = "all",
  asset = "all",
  maxAccumulationPages = 5,
}: UsePaymentHistoryOptions = {}): UsePaymentHistoryReturn {
  const [accumulatedPayments, setAccumulatedPayments] = useState<NormalizedPayment[]>([])
  const [accumulationBoundHit, setAccumulationBoundHit] = useState(false)
  const [isAccumulating, setIsAccumulating] = useState(false)
  
  // Track the number of underlying pages fetched for the current accumulation cycle
  const pagesFetchedRef = useRef(0)
  // Track seen IDs to prevent duplicates during accumulation
  const seenIdsRef = useRef<Set<string>>(new Set())

  const basePayments = usePayments({ address, limit, order, cursor })

  // Memoize on primitives to prevent inline object props (like asset={{ code, issuer }}) from breaking identity
  const assetFilter = asset === "all" ? "all" : `${asset.code}-${asset.issuer}`

  // 1. Reset state when query parameters change
  const queryParamsKey = `${address}-${limit}-${order}-${direction}-${assetFilter}`
  useEffect(() => {
    setAccumulatedPayments([])
    setAccumulationBoundHit(false)
    setIsAccumulating(false)
    pagesFetchedRef.current = 0
    seenIdsRef.current = new Set()
  }, [queryParamsKey])

  // 2. Accumulation loop
  useEffect(() => {
    if (basePayments.loading || basePayments.error) return

    const newMatches = basePayments.payments.filter((p) => {
      if (seenIdsRef.current.has(p.id)) return false

      let match = true
      if (direction !== "all" && p.direction !== direction) match = false
      if (asset !== "all" && p.asset !== "XLM") {
        if (typeof p.asset === "object") {
          if (p.asset.code !== asset.code || p.asset.issuer !== asset.issuer) match = false
        } else {
          match = false // Record is XLM but we are filtering for a specific issued asset
        }
      } else if (asset !== "all" && p.asset === "XLM") {
        match = false // Record is XLM but filter is an object
      }

      return match
    })

    if (newMatches.length > 0 || basePayments.payments.length > 0) {
      newMatches.forEach(p => seenIdsRef.current.add(p.id))
      setAccumulatedPayments((prev) => [...prev, ...newMatches])
    }

    // Check if we need more pages to fulfill the limit
    const totalMatches = seenIdsRef.current.size
    pagesFetchedRef.current += 1

    if (totalMatches < limit && basePayments.hasNext) {
      if (pagesFetchedRef.current >= maxAccumulationPages) {
        setAccumulationBoundHit(true)
        setIsAccumulating(false)
      } else {
        setIsAccumulating(true)
        basePayments.fetchNext() // keep digging
      }
    } else {
      setIsAccumulating(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePayments.payments, basePayments.loading, basePayments.error, limit, direction, assetFilter, maxAccumulationPages])

  const fetchNext = useCallback(async () => {
    if (basePayments.hasNext && !isAccumulating) {
      pagesFetchedRef.current = 0
      setAccumulationBoundHit(false)
      setIsAccumulating(true)
      seenIdsRef.current.clear() // Clear to accumulate the *next* `limit` batch
      setAccumulatedPayments([])
      await basePayments.fetchNext()
    }
  }, [basePayments, isAccumulating])

  // hasNext must solely depend on the source record availability, not the match count
  const hasNext = basePayments.hasNext

  return {
    payments: accumulatedPayments,
    loading: basePayments.loading || isAccumulating,
    error: basePayments.error,
    refetch: basePayments.refetch,
    fetchNext,
    fetchPrev: basePayments.fetchPrev,
    hasNext,
    hasPrev: basePayments.hasPrev,
    accumulationBoundHit,
  }
}