import { useState, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { canSignTransactions } from "../utils"
import { createStellarError } from "../errors"
import { pathPayment as pathPaymentAction } from "../actions/pathPayment"
import { offlineError, onlineManager } from "../runtime/onlineManager"
import type {
  PathPaymentOptions,
  StellarError,
  TransactionResult,
  UsePathPaymentReturn,
  SubmissionPhase,
} from "../types"

/**
 * Horizon operation result codes that mean the rate moved between the quote
 * and execution — the slippage bound did its job.
 */
const SLIPPAGE_RESULT_CODES = ["op_under_dest_min", "op_over_source_max"] as const

export type { UsePathPaymentReturn }

/** Reads Horizon operation result codes off a thrown submission error. */
function getOperationResultCodes(error: unknown): string[] {
  if (!error || typeof error !== "object" || !("response" in error)) return []

  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== "object") return []

  const data = (response as { data?: unknown }).data
  if (!data || typeof data !== "object") return []

  const extras = (data as { extras?: unknown }).extras
  if (!extras || typeof extras !== "object") return []

  const resultCodes = (extras as { result_codes?: unknown }).result_codes
  if (!resultCodes || typeof resultCodes !== "object") return []

  const operations = (resultCodes as { operations?: unknown }).operations
  return Array.isArray(operations)
    ? operations.filter((op): op is string => typeof op === "string")
    : []
}

/**
 * Turns a slippage failure into an error a UI can act on.
 *
 * `op_under_dest_min` / `op_over_source_max` mean the rate moved, not that the
 * transaction was malformed — "the rate moved, re-quote and try again" is a
 * very different message from "transaction failed".
 */
function toPathPaymentError(error: unknown, mode: PathPaymentOptions["mode"]): StellarError {
  const operations = getOperationResultCodes(error)
  const slippage = SLIPPAGE_RESULT_CODES.find(code => operations.includes(code))

  if (slippage) {
    const bound = mode === "strictSend" ? "destMin" : "sendMax"
    return createStellarError(
      "TRANSACTION_FAILED",
      `The rate moved past your slippage bound (${slippage}). ` +
        `Re-fetch the path with usePaymentPaths, recompute \`${bound}\`, and submit again.`,
      { raw: error }
    )
  }

  // If the error is a thrown StellarError, use it; otherwise wrap as UNKNOWN
  if (error instanceof Error && "code" in error && typeof (error as any).code === "string") {
    return error as StellarError
  }

  return createStellarError("UNKNOWN", "An unknown error occurred", { raw: error })
}

/**
 * Validates the options a JavaScript caller might get wrong.
 *
 * TypeScript's discriminated union already makes a missing bound a compile
 * error; this is the backstop for callers who are not compiling.
 */
function assertValidOptions(options: PathPaymentOptions): void {
  if (!options || typeof options !== "object") {
    throw createStellarError("VALIDATION_ERROR", "usePathPayment: options are required.")
  }

  if (!options.destination) {
    throw createStellarError("VALIDATION_ERROR", "usePathPayment: `destination` is required.")
  }

  if (options.mode === "strictSend") {
    if (!options.sendAmount) {
      throw createStellarError(
        "VALIDATION_ERROR",
        'usePathPayment: "strictSend" requires `sendAmount`.'
      )
    }
    if (!options.destMin) {
      throw createStellarError(
        "VALIDATION_ERROR",
        'usePathPayment: "strictSend" requires `destMin`, the least the recipient will accept. ' +
          "There is no default — a permissive bound authorises the network to give the recipient nothing."
      )
    }
    return
  }

  if (options.mode === "strictReceive") {
    if (!options.destAmount) {
      throw createStellarError(
        "VALIDATION_ERROR",
        'usePathPayment: "strictReceive" requires `destAmount`.'
      )
    }
    if (!options.sendMax) {
      throw createStellarError(
        "VALIDATION_ERROR",
        'usePathPayment: "strictReceive" requires `sendMax`, the most you will spend. ' +
          "There is no default — an unbounded maximum authorises the network to spend everything."
      )
    }
    return
  }

  throw createStellarError(
    "VALIDATION_ERROR",
    `usePathPayment: unknown mode ${JSON.stringify((options as { mode?: unknown }).mode)}. ` +
      'Use "strictSend" or "strictReceive".'
  )
}

/**
 * Sends a path payment — Stellar's built-in swap.
 *
 * You send one asset, the recipient receives another, and the network routes
 * through the order book and liquidity pools atomically: either the whole
 * conversion happens at an acceptable rate, or nothing does.
 *
 * Which side is pinned depends on the mode:
 * - `strictSend` pins `sendAmount` and bounds the result with `destMin` — the
 *   least the recipient will accept.
 * - `strictReceive` pins `destAmount` and bounds the cost with `sendMax` — the
 *   most you will spend.
 *
 * **The bound is the slippage protection and it is required.** Rates move
 * between quoting and signing; the bound is what stops the transaction
 * executing at a rate you never agreed to.
 *
 * `path` comes from `usePaymentPaths`. An empty array is valid and means a
 * direct conversion — it is not a missing value.
 *
 * @example
 * const { pathPayment } = usePathPayment()
 * // quote first, then bound it with an explicit tolerance
 * await pathPayment({
 *   mode: "strictSend",
 *   destination: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
 *   sendAsset: "XLM",
 *   sendAmount: "100",
 *   destAsset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
 *   destMin: "24.7500000",
 *   path: [],
 * })
 */
export function usePathPayment(): UsePathPaymentReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()

  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<SubmissionPhase>("idle")
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  const pathPayment = useCallback(
    async (options: PathPaymentOptions): Promise<TransactionResult> => {
      if (!wallet.connected || !wallet.address) {
        throw createStellarError(
          "WALLET_NOT_CONNECTED",
          "Wallet not connected. Call connect() first."
        )
      }
      if (!wallet.wallet) {
        throw createStellarError(
          "WALLET_NOT_CONNECTED",
          "No wallet adapter selected. Call connect() first."
        )
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

      assertValidOptions(options)

      // Fail fast offline — a signed payment is never queued for later.
      if (!onlineManager.isOnline()) throw offlineError()

      setLoading(true)
      setPhase("building")
      setError(null)
      setResult(null)

      try {
        const outcome = await pathPaymentAction(
          {
            network,
            networkConfig,
            wallet,
            queryStore,
            onPhase: setPhase,
          },
          options
        )
        setResult(outcome)
        return outcome
      } catch (err) {
        const stellarError = toPathPaymentError(err, options.mode)
        setError(stellarError)
        setPhase("idle")
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
    setPhase("idle")
  }, [])

  return { pathPayment, loading, phase, error, result, reset }
}
