// packages/core/src/hooks/useStreamPayments.ts

import { useCallback, useEffect, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isBrowser } from "../utils"
import { normalizePayment, type PaymentRecord } from "../utils/normalizePayment"
import { computeBackoffDelay } from "../utils/retryWithBackoff"
import { createStellarError } from "../errors"
import type {
  NormalizedPayment,
  StellarError,
  UseStreamPaymentsOptions,
  UseStreamPaymentsReturn,
} from "../types"

const DEFAULT_BUFFER_SIZE = 50

interface StreamState {
  payments: NormalizedPayment[]
  connected: boolean
  error: StellarError | null
  cursor: string | null
}

const INITIAL_STATE: StreamState = {
  payments: [],
  connected: false,
  error: null,
  cursor: null,
}

/**
 * Live-tails an account's payments over Horizon's Server-Sent Events, so a
 * UI can answer "did the money arrive yet?" within a ledger close instead of
 * polling `useBalance` every few seconds.
 *
 * Reconnects with jittered exponential backoff and resumes from the last
 * cursor seen, so a dropped connection does not silently lose events. SSE is
 * browser-only: on the server this hook opens no connection and returns an
 * inert result.
 *
 * @example
 * const { payments, connected } = useStreamPayments({ cursor: "now" })
 */
export function useStreamPayments({
  address,
  cursor: initialCursor = "now",
  bufferSize = DEFAULT_BUFFER_SIZE,
  enabled = true,
}: UseStreamPaymentsOptions = {}): UseStreamPaymentsReturn {
  const { network, networkConfig, wallet } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const [state, setState] = useState<StreamState>(INITIAL_STATE)

  const closeRef = useRef<(() => void) | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorRef = useRef<string>(initialCursor)
  const deliberateCloseRef = useRef(false)
  const attemptRef = useRef(0)
  const addressRef = useRef(resolvedAddress)
  addressRef.current = resolvedAddress

  const closeCurrent = useCallback(() => {
    deliberateCloseRef.current = true
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (closeRef.current) {
      closeRef.current()
      closeRef.current = null
    }
    setState(s => ({ ...s, connected: false }))
  }, [])

  const openStream = useCallback(() => {
    const currentAddress = addressRef.current
    if (!isBrowser() || !currentAddress) return

    deliberateCloseRef.current = false

    const server = getHorizonServer(networkConfig)
    const close = server
      .payments()
      .forAccount(currentAddress)
      .cursor(cursorRef.current)
      .stream({
        onmessage: (record: unknown) => {
          const normalized = normalizePayment(record as PaymentRecord, currentAddress)
          const pagingToken = (record as { paging_token?: string }).paging_token
          if (pagingToken) cursorRef.current = pagingToken
          attemptRef.current = 0

          setState(s => ({
            connected: true,
            error: null,
            cursor: cursorRef.current,
            payments: [normalized, ...s.payments].slice(0, bufferSize),
          }))
        },
        onerror: () => {
          // A deliberate close (unmount, `enabled: false`, manual reconnect)
          // also fires the stream's error event — that is not a failure, so it
          // must not surface as one, the same way a deliberate abort does not
          // set `error` elsewhere in this library.
          if (deliberateCloseRef.current) return

          const delay = computeBackoffDelay(attemptRef.current)
          attemptRef.current += 1

          setState(s => ({
            ...s,
            connected: false,
            error: createStellarError(
              "NETWORK_ERROR",
              "Payment stream connection lost. Reconnecting…"
            ),
          }))

          reconnectTimerRef.current = setTimeout(() => {
            openStream()
          }, delay)
        },
      })

    closeRef.current = close
    setState(s => ({ ...s, connected: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkConfig.horizonUrl, bufferSize])

  const reconnect = useCallback(() => {
    closeCurrent()
    attemptRef.current = 0
    openStream()
  }, [closeCurrent, openStream])

  const clear = useCallback(() => {
    setState(s => ({ ...s, payments: [] }))
  }, [])

  useEffect(() => {
    if (!enabled || !resolvedAddress || !isBrowser()) {
      closeCurrent()
      return
    }

    openStream()

    return () => {
      closeCurrent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resolvedAddress, network, networkConfig.horizonUrl])

  return {
    payments: state.payments,
    connected: state.connected,
    error: state.error,
    cursor: state.cursor,
    reconnect,
    clear,
  }
}
