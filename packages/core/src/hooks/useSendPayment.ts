import { useState, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { canSignTransactions } from "../utils"
import { createStellarError } from "../errors"
import { sendPayment, SendPaymentAbortedError, isPreflightError } from "../actions/sendPayment"
import { offlineError, onlineManager } from "../runtime/onlineManager"
import type { SendPaymentOptions, SendPaymentResult, StellarError } from "../types"

export interface UseSendPaymentReturn {
  send: (options: SendPaymentOptions) => Promise<SendPaymentResult & { error?: string }>
  loading: boolean
  error: StellarError | null
  result: SendPaymentResult | null
  reset: () => void
}

/**
 * Builds, signs, and submits a payment transaction to the Stellar network.
 *
 * The fee is bid from the network's current base fee, multiplied by
 * {@link DEFAULT_FEE_MULTIPLIER}, rather than pinned to the SDK's `BASE_FEE`
 * constant — that constant is the network minimum, which is rejected during
 * congestion. A fee is a maximum bid, not a charge: the network takes only
 * what it needs, so a generous bid costs nothing on a quiet ledger.
 *
 * This hook is a thin React adapter over the framework-neutral
 * {@link sendPayment} action: it owns only `loading`/`error`/`result`/`reset`
 * state, while the action owns validation, transaction construction, signing,
 * submission, and cache invalidation.
 *
 * @returns `{ send, loading, error, result, reset }`
 *
 * @example
 * const { send, loading } = useSendPayment()
 * await send({ to: "G...", asset: "XLM", amount: "10" })
 *
 * @example
 * // Bid harder during known congestion, or pin the fee exactly.
 * await send({ to: "G...", asset: "XLM", amount: "10", feeMultiplier: 50 })
 * await send({ to: "G...", asset: "XLM", amount: "10", fee: "100000" })
 */
export function useSendPayment(): UseSendPaymentReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<SendPaymentResult | null>(null)

  const send = useCallback(
    async (options: SendPaymentOptions): Promise<SendPaymentResult & { error?: string }> => {
      if (!wallet.connected || !wallet.address) {
        throw createStellarError(
          "WALLET_NOT_CONNECTED",
          "Wallet not connected. Call connect() first."
        )
      }
      if (!wallet.wallet) {
        throw new Error("No wallet adapter selected. Call connect() first.")
      }

      if (!canSignTransactions()) {
        throw createStellarError(
          "VALIDATION_ERROR",
          "Transaction signing is only available in the browser or React Native. " +
            'Move your component to a "use client" boundary in Next.js / Remix.'
        )
      }

      // Check for network mismatch
      if (wallet.walletNetwork && wallet.network !== wallet.walletNetwork) {
        throw createStellarError(
          "WRONG_NETWORK",
          `Network mismatch: Provider is on ${wallet.network} but wallet is on ${wallet.walletNetwork}. ` +
            `Switch your wallet to ${wallet.network} or call refreshWalletNetwork() to update.`
        )
      }

      // Fail fast offline — a signed payment is never queued for later.
      if (!onlineManager.isOnline()) throw offlineError()

      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const outcome = await sendPayment({ network, networkConfig, wallet, queryStore }, options)
        setResult(outcome)
        return outcome
      } catch (err) {
        if (err instanceof SendPaymentAbortedError) {
          // A deliberate cancellation is not an error — mirrors the original
          // hook's non-throwing abort return.
          return { hash: "", status: "failed", error: err.message }
        }

        // Pre-flight guard failures (wallet not connected, no adapter, non-
        // browser, wrong network) are thrown before any state would be
        // touched — the original hook never called setError/setResult for
        // these, so the code lives only on the thrown object.
        if (isPreflightError(err)) {
          throw err
        }

        const stellarError = err as StellarError

        // On TX_TIMEOUT (504), the action's error carries the pre-computed
        // hash so we can still record it as "pending" and let the caller poll
        // useTransaction(hash).
        if (stellarError.code === "TX_TIMEOUT") {
          const timeoutOutcome: SendPaymentResult = {
            hash: stellarError.hash ?? "",
            status: "pending",
          }
          setResult(timeoutOutcome)
          setError(stellarError)
          throw stellarError
        }

        // Only a submission that Horizon accepted but reported unsuccessful
        // (`res.successful === false`) records a "failed" result — the action
        // marks that specific case. Every other failure (a rejected
        // submitTransaction call, etc.) surfaces only as `error`, exactly as
        // the original hook did.
        if (
          (stellarError as StellarError & { isSubmissionFailure?: boolean }).isSubmissionFailure
        ) {
          const failedOutcome: SendPaymentResult = {
            hash: stellarError.hash ?? "",
            status: "failed",
          }
          setResult(failedOutcome)
        }

        setError(stellarError)
        throw stellarError
      } finally {
        setLoading(false)
      }
    },
    [network, networkConfig, wallet, queryStore]
  )

  const reset = useCallback(() => {
    setError(null)
    setResult(null)
  }, [])

  return { send, loading, error, result, reset }
}
