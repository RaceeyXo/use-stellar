import { useCallback, useEffect, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { isBrowser } from "../utils"
import { createPaymentStream, type PaymentStreamController, type PaymentStreamSnapshot } from "../queries/paymentStream"
import type { UseStreamPaymentsOptions, UseStreamPaymentsReturn } from "../types"

const EMPTY: PaymentStreamSnapshot = { payments: [], connected: false, error: null, cursor: null }

export function useStreamPayments({ address, cursor = "now", bufferSize = 50, enabled = true }: UseStreamPaymentsOptions = {}): UseStreamPaymentsReturn {
  const { network, networkConfig, wallet } = useStellarContext()
  const resolvedAddress = address ?? wallet.address
  const controller = useRef<PaymentStreamController | null>(null)
  const [snapshot, setSnapshot] = useState(EMPTY)

  useEffect(() => {
    controller.current?.close()
    controller.current = null
    setSnapshot(EMPTY)
    if (!enabled || !resolvedAddress || !isBrowser()) return
    const stream = createPaymentStream({ networkConfig, address: resolvedAddress, cursor, bufferSize })
    controller.current = stream
    const unsubscribe = stream.subscribe(setSnapshot)
    stream.start()
    return () => { unsubscribe(); stream.close(); if (controller.current === stream) controller.current = null }
  }, [enabled, resolvedAddress, cursor, bufferSize, network, networkConfig.horizonUrl])

  const reconnect = useCallback(() => controller.current?.reconnect(), [])
  const clear = useCallback(() => controller.current?.clear(), [])
  return { ...snapshot, reconnect, clear }
}
