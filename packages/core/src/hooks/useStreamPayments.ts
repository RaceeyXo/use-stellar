import { useState, useEffect, useRef, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isBrowser } from "../utils"
import { toStellarError } from "../errors"
import { normalizePayment, PaymentRecord } from "../utils/normalizers"
import type {
  NormalizedPayment,
  StellarError,
  UseStreamPaymentsOptions,
  UseStreamPaymentsReturn,
} from "../types"

export function useStreamPayments({
  address,
  cursor = "now",
  enabled = true,
}: UseStreamPaymentsOptions = {}): UseStreamPaymentsReturn {
  const { network, wallet } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const [payments, setPayments] = useState<NormalizedPayment[]>([])
  const [latest, setLatest] = useState<NormalizedPayment | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  const closeStreamRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    if (closeStreamRef.current) {
      closeStreamRef.current()
      closeStreamRef.current = null
      setStreaming(false)
    }
  }, [])

  const start = useCallback(() => {
    if (!enabled || !resolvedAddress || !isBrowser() || closeStreamRef.current) {
      return
    }

    if (closeStreamRef.current) {
      closeStreamRef.current()
    }
    
    setError(null)
    setStreaming(true)

    const server = getHorizonServer(network)
    const stream = server
      .payments()
      .forAccount(resolvedAddress)
      .cursor(cursor)
      .stream({
        onmessage: (record: PaymentRecord) => {
          const normalized = normalizePayment(record, resolvedAddress)
          setPayments(prev => [normalized, ...prev])
          setLatest(normalized)
        },
        onerror: (err: any) => {
          setError(toStellarError(err))
          setStreaming(false)
        },
      })

    closeStreamRef.current = stream
  }, [resolvedAddress, network, cursor, enabled])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  return {
    payments,
    latest,
    streaming,
    error,
    stop,
    start,
  }
}