import { useState, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { canSignTransactions } from "../utils"
import { createStellarError } from "../errors"
import { addTrustline, AddTrustlineAbortedError, isPreflightError } from "../actions/addTrustline"
import { offlineError, onlineManager } from "../runtime/onlineManager"
import type {
  AddTrustlineOptions,
  TransactionResult,
  StellarError,
  UseAddTrustlineReturn,
  SubmissionPhase,
} from "../types"

/**
 * Builds, signs, and submits a `changeTrust` transaction to establish a trustline
 * for an asset, allowing an account to hold it.
 *
 * @returns `{ addTrustline, loading, phase, error, result, reset }`
 *
 * @example
 * const { addTrustline, loading } = useAddTrustline()
 * await addTrustline({
 *   asset: { code: "USDC", issuer: "G..." }
 * })
 */
export function useAddTrustline(): UseAddTrustlineReturn {
  const { network, networkConfig, wallet, queryStore, transactionTimeout } = useStellarContext()

  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<SubmissionPhase>("idle")
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  const addTrustlineCallback = useCallback(
    async (options: AddTrustlineOptions): Promise<TransactionResult> => {
      if (!wallet.connected || !wallet.address) {
        throw createStellarError(
          "WALLET_NOT_CONNECTED",
          "Wallet not connected. Call connect() first."
        )
      }
      if (!wallet.wallet) {
        throw createStellarError("WALLET_NOT_CONNECTED", "No wallet adapter selected.")
      }

      if (!canSignTransactions()) {
        throw createStellarError(
          "VALIDATION_ERROR",
          "Transaction signing is only available in the browser or React Native. " +
            'Move your component to a "use client" boundary in Next.js / Remix.'
        )
      }

      if (wallet.walletNetwork && wallet.network !== wallet.walletNetwork) {
        throw createStellarError(
          "WRONG_NETWORK",
          `Network mismatch: Provider is on ${wallet.network} but wallet is on ${wallet.walletNetwork}. ` +
            `Switch your wallet to ${wallet.network} or call refreshWalletNetwork() to update.`
        )
      }

      // Fail fast offline — a signed transaction is never queued for later.
      if (!onlineManager.isOnline()) throw offlineError()

      setLoading(true)
      setPhase("building")
      setError(null)
      setResult(null)

      try {
        const outcome = await addTrustline(
          {
            network,
            networkConfig,
            wallet,
            queryStore,
            transactionTimeout,
            onPhase: setPhase,
          },
          options
        )
        setResult(outcome)
        return outcome
      } catch (err) {
        if (err instanceof AddTrustlineAbortedError) {
          // A deliberate cancellation is not an error
          setPhase("idle")
          throw err
        }

        // Pre-flight guard failures are thrown before any state would be touched
        if (isPreflightError(err)) {
          setPhase("idle")
          throw err
        }

        const stellarError = err as StellarError

        // On TX_TIMEOUT (504), we have the hash but don't know the outcome yet.
        if (stellarError.code === "TX_TIMEOUT") {
          setPhase("idle")
          setError(stellarError)
          throw stellarError
        }

        setError(stellarError)
        setPhase("idle")
        throw stellarError
      } finally {
        setLoading(false)
      }
    },
    [network, networkConfig, wallet, queryStore, transactionTimeout]
  )

  const reset = useCallback(() => {
    setError(null)
    setResult(null)
    setPhase("idle")
  }, [])

  return { addTrustline: addTrustlineCallback, loading, phase, error, result, reset }
}
