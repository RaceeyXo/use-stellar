import { useState, useEffect, useCallback, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import type {
  UsePaymentsOptions,
  UsePaymentsReturn,
  NormalizedPayment,
  StellarError,
} from "../types"
import type { Horizon } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"
import { PaymentRecord, normalizePayment } from "../utils/normalizers"

export function usePayments({
  address,
  limit = 10,
  order = "desc",
  cursor,
}: UsePaymentsOptions = {}): UsePaymentsReturn {
  const { network, wallet } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const [payments, setPayments] = useState<NormalizedPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  // Store page navigation functions from the Horizon response
  const nextRef = useRef<(() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null>(
    null
  )
  const prevRef = useRef<(() => Promise<Horizon.ServerApi.CollectionPage<PaymentRecord>>) | null>(
    null
  )

  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)

  const fetchPayments = useCallback(async () => {
    if (!resolvedAddress) {
      setPayments([])
      setHasNext(false)
      setHasPrev(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const server = getHorizonServer(network)
      let query = server.payments().forAccount(resolvedAddress).limit(limit).order(order)
      if (cursor) {
        query = query.cursor(cursor)
      }

      const res = await query.call()
      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress))
      setPayments(normalized)

      // Save pagination callbacks
      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setHasNext(res.records.length >= limit)
      setHasPrev(!!cursor)
    } catch (err) {
      setError(toStellarError(err))
    } finally {
      setLoading(false)
    }
  }, [resolvedAddress, network, limit, order, cursor])

  const fetchNext = useCallback(async () => {
    if (!nextRef.current) return
    setLoading(true)
    setError(null)
    try {
      const res = await nextRef.current()
      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress!))
      setPayments(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setHasNext(res.records.length >= limit)
      setHasPrev(true)
    } catch (err) {
      setError(toStellarError(err))
    } finally {
      setLoading(false)
    }
  }, [resolvedAddress, limit])

  const fetchPrev = useCallback(async () => {
    if (!prevRef.current) return
    setLoading(true)
    setError(null)
    try {
      const res = await prevRef.current()
      const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress!))
      setPayments(normalized)

      nextRef.current = res.records.length > 0 ? () => res.next() : null
      prevRef.current = res.records.length > 0 ? () => res.prev() : null

      setHasNext(true)
      setHasPrev(res.records.length >= limit)
    } catch (err) {
      setError(toStellarError(err))
    } finally {
      setLoading(false)
    }
  }, [resolvedAddress, limit])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  return {
    payments,
    loading,
    error,
    refetch: fetchPayments,
    fetchNext,
    fetchPrev,
    hasNext,
    hasPrev,
  }
}


