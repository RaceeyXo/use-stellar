import { createStellarError } from "../errors"
import { getHorizonServer } from "../utils"
import { computeBackoffDelay } from "../utils/retryWithBackoff"
import { normalizePayment, type PaymentRecord } from "./payments"
import type { NetworkConfig, NormalizedPayment, StellarError } from "../types"

export interface PaymentStreamSnapshot {
  payments: NormalizedPayment[]
  connected: boolean
  error: StellarError | null
  cursor: string | null
}

export interface PaymentStreamController {
  start: () => void
  close: () => void
  reconnect: () => void
  clear: () => void
  getSnapshot: () => PaymentStreamSnapshot
  subscribe: (listener: (snapshot: PaymentStreamSnapshot) => void) => () => void
}

export function createPaymentStream(options: {
  networkConfig: NetworkConfig
  address: string
  cursor?: string
  bufferSize?: number
}): PaymentStreamController {
  const listeners = new Set<(snapshot: PaymentStreamSnapshot) => void>()
  let snapshot: PaymentStreamSnapshot = { payments: [], connected: false, error: null, cursor: null }
  let cursor = options.cursor ?? "now"
  let closeSource: (() => void) | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0
  let attempts = 0

  const emit = (next: Partial<PaymentStreamSnapshot>) => {
    snapshot = { ...snapshot, ...next }
    listeners.forEach(listener => listener(snapshot))
  }
  const close = () => {
    generation += 1
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    closeSource?.()
    closeSource = null
    emit({ connected: false })
  }
  const start = () => {
    close()
    const activeGeneration = generation
    const source = getHorizonServer(options.networkConfig)
      .payments().forAccount(options.address).cursor(cursor).stream({
        onmessage: record => {
          if (activeGeneration !== generation) return
          const token = (record as { paging_token?: string }).paging_token
          if (token) cursor = token
          attempts = 0
          emit({ connected: true, error: null, cursor, payments: [normalizePayment(record as PaymentRecord, options.address), ...snapshot.payments].slice(0, options.bufferSize ?? 50) })
        },
        onerror: () => {
          if (activeGeneration !== generation) return
          closeSource?.()
          closeSource = null
          emit({ connected: false, error: createStellarError("NETWORK_ERROR", "Payment stream connection lost. Reconnecting...") })
          reconnectTimer = setTimeout(start, computeBackoffDelay(attempts++))
        },
      })
    closeSource = source
    emit({ connected: true })
  }
  return {
    start,
    close,
    reconnect: () => { attempts = 0; start() },
    clear: () => emit({ payments: [] }),
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener) },
  }
}
