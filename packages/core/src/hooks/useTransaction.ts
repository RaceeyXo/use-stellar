import { useEffect, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, transactionKey } from "../cache"
import type { StellarError, TransactionResult, TransactionStatus } from "../types"

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

  const queryKey = hash
    ? transactionKey(networkConfig.horizonUrl, network, hash)
    : (["transaction", "disabled"] as const)

  const {
    data: transaction,
    loading,
    error: rawError,
    refetch,
  } = useQuery<TransactionResult>({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      try {
        const raw = await server.transactions().transaction(hash!).call()
        const status: TransactionStatus = raw.successful ? "success" : "failed"
        return {
          hash: raw.hash,
          status,
          ledger: Number(raw.ledger),
          createdAt: raw.created_at,
          fee: String(raw.fee_charged),
          envelope: raw.envelope_xdr,
        }
      } catch (err) {
        const is404 = (err as { response?: { status: number } })?.response?.status === 404
        if (is404) {
          return {
            hash: hash!,
            status: watch ? ("pending" as TransactionStatus) : ("not_found" as TransactionStatus),
          }
        }
        throw err
      }
    },
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

    const id = setInterval(() => {
      const status = transactionRef.current?.status
      if (status === "success" || status === "failed") return
      refetchRef.current()
    }, 3000)

    return () => clearInterval(id)
  }, [watch, hash])

  const error = rawError ? toStellarError(rawError) : null

  return { transaction, loading, error, refetch }
}
