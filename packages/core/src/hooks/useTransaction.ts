import { useEffect, useMemo, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { toStellarError } from "../errors"
import { useQuery } from "../cache"
import { fetchTransaction, transactionKey } from "../queries/transaction"
import { focusManager } from "../runtime/focusManager"
import type { StellarError, TransactionResult } from "../types"

export interface UseTransactionOptions {
  hash: string | null
  watch?: boolean // keep polling until success or failed
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

export interface UseTransactionReturn {
  transaction: TransactionResult | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

/**
 * Fetches the status and details of a specific transaction by hash.
 *
 * Results are cached in the shared QueryStore.
 *
 * @param options - Configuration options
 * @param options.hash - The transaction hash to look up
 * @param options.watch - When true, keeps polling until the transaction succeeds or fails
 * @param options.staleTime - Override the provider-level staleTime for this hook.
 * @returns `{ transaction, loading, error, refetch }`
 *
 * @example
 * const { transaction } = useTransaction({ hash: "...", watch: true })
 */
export function useTransaction({
  hash,
  watch = false,
  staleTime,
  maxRetries,
}: UseTransactionOptions): UseTransactionReturn {
  const { network, networkConfig, queryStore } = useStellarContext()

  const queryKey = useMemo(
    () =>
      hash
        ? transactionKey(networkConfig.horizonUrl, network, hash)
        : (["transaction", "disabled"] as const),
    [hash, networkConfig.horizonUrl, network]
  )

  const {
    data: transaction,
    loading,
    error: rawError,
    refetch,
  } = useQuery<TransactionResult>({
    queryKey,
    queryFn: () => fetchTransaction(networkConfig, { hash: hash!, watch }),
    store: queryStore,
    staleTime,
    enabled: Boolean(hash),
    maxRetries,
  })

  // Keep stable refs so the interval doesn't close over a stale refetch or a
  // stale transaction. Refs must not be written during render (unsafe under
  // StrictMode and concurrent rendering), so sync them in effects instead.
  const refetchRef = useRef(refetch)
  useEffect(() => {
    refetchRef.current = refetch
  }, [refetch])

  const transactionRef = useRef(transaction)
  useEffect(() => {
    transactionRef.current = transaction
  }, [transaction])

  // Polling for watch mode: keep going until settled.
  useEffect(() => {
    if (!watch || !hash) return

    let id: ReturnType<typeof setInterval> | undefined
    const start = () => {
      if (id !== undefined) clearInterval(id)
      if (!focusManager.isFocused()) return
      id = setInterval(() => {
        if (!focusManager.isFocused()) return
        const status = transactionRef.current?.status
        if (status === "success" || status === "failed") return
        refetchRef.current()
      }, 3000)
    }
    start()
    const unsubscribeFocus = focusManager.subscribe(focused => {
      if (id !== undefined) {
        clearInterval(id)
        id = undefined
      }
      if (!focused) return
      const entry = queryStore.getSnapshot(queryKey)
      const status = transactionRef.current?.status
      if (
        entry?.subscribers &&
        status !== "success" &&
        status !== "failed" &&
        !queryStore.isLoading(queryKey) &&
        !queryStore.isFresh(queryKey, staleTime)
      )
        refetchRef.current()
      start()
    })

    return () => {
      if (id !== undefined) clearInterval(id)
      unsubscribeFocus()
    }
  }, [watch, hash, queryStore, network, networkConfig.horizonUrl, staleTime, queryKey])

  const error = rawError ? toStellarError(rawError) : null

  return { transaction, loading, error, refetch }
}
