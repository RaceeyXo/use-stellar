import { type StellarErrorCode } from "./codes"
import { isStellarError, StellarError, type StellarErrorOptions } from "./StellarError"
import type { WalletAdapterErrorCode } from "../wallets/types"

/**
 * Create a typed {@link StellarError}. When `message` is omitted the default
 * human-readable message for `code` is used.
 *
 * @example
 * throw createStellarError("WALLET_NOT_CONNECTED")
 * throw createStellarError("WRONG_NETWORK", `Switch Freighter to ${network}.`)
 */
export function createStellarError(
  code: StellarErrorCode,
  message?: string,
  options?: StellarErrorOptions
): StellarError {
  return new StellarError(code, message, options)
}

// ── Internal: best-effort extraction of a Horizon/Axios style response ──────
interface HorizonResultCodes {
  transaction?: string
  operations?: string[]
}

/**
 * Horizon speaks RFC 7807 problem details.

 *
 * `type` is a stable URI like `https://stellar.org/horizon-errors/not_found`,
 * which is far more reliable than either the status code or the prose in
 * `title` / `detail` — it does not move when a message is reworded and it does
 * not vary by locale.
 */
interface HorizonProblemDetails {
  type?: string
  title?: string
  detail?: string
  status?: number
  extras?: { result_codes?: HorizonResultCodes }
}

interface HorizonLikeResponse {
  status?: number
  data?: HorizonProblemDetails
}

interface HorizonSubmissionResult {
  hash: string
  extras?: { result_codes?: HorizonResultCodes }
}

const WALLET_ERROR_CODES: Record<WalletAdapterErrorCode, StellarErrorCode> = {
  wallet_unavailable: "WALLET_NOT_INSTALLED",
  wallet_unsupported: "WALLET_UNSUPPORTED",
  wallet_access_rejected: "WALLET_REQUEST_REJECTED",
  wallet_network_mismatch: "WRONG_NETWORK",
  wallet_sign_failed: "SIGNING_FAILED",
}

/**
 * Classify a transaction Horizon accepted with a 200 but which failed on the
 * network (`successful: false`).
 *
 * Delegates to {@link fromResultCodes} rather than re-testing result codes
 * here. Horizon reports the same codes whether it answers 200-with-failure or
 * rejects outright, so a second table would only be a copy that drifts — which
 * is exactly what it did: `tx_bad_seq` and `tx_insufficient_fee` were named on
 * the rejection path and flattened to `TRANSACTION_FAILED` on this one.
 */
export function toSubmissionError(result: HorizonSubmissionResult): StellarError {
  const resultCodes = result.extras?.result_codes
  const code: StellarErrorCode =
    (resultCodes && fromResultCodes(resultCodes)) || "TRANSACTION_FAILED"

  return createStellarError(code, undefined, {
    raw: result,
    hash: result.hash,
  })
}

function getResponse(error: unknown): HorizonLikeResponse | undefined {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: unknown }).response
    if (response && typeof response === "object") return response as HorizonLikeResponse
  }
  return undefined
}

/**
 * The trailing segment of a Horizon problem-details `type` URI.
 *
 * `https://stellar.org/horizon-errors/not_found` → `not_found`.
 */
function getProblemType(response: HorizonLikeResponse | undefined): string | undefined {
  const type = response?.data?.type
  if (typeof type !== "string" || type === "") return undefined

  const segment = type.split("/").filter(Boolean).pop()
  return segment?.toLowerCase()
}

/** Maps a Horizon problem-details type onto an error code, where one fits. */
function fromProblemType(problemType: string | undefined): StellarErrorCode | undefined {
  switch (problemType) {
    case "not_found":
      return "ACCOUNT_NOT_FOUND"
    case "rate_limit_exceeded":
      return "RATE_LIMITED"
    case "timeout":
    case "server_over_capacity":
      return "NETWORK_ERROR"
    default:
      return undefined
  }
}

/** Maps Horizon transaction/operation result codes onto an error code. */
function fromResultCodes(resultCodes: HorizonResultCodes): StellarErrorCode | undefined {
  const operations = resultCodes.operations ?? []
  const transaction = resultCodes.transaction

  // Operation codes are the most specific signal available.
  if (operations.includes("op_no_trust")) return "NO_TRUSTLINE"
  if (operations.includes("op_no_destination")) return "DESTINATION_NOT_FOUND"
  if (operations.includes("op_line_full")) return "TRUSTLINE_LIMIT_EXCEEDED"
  if (operations.includes("op_underfunded")) return "INSUFFICIENT_BALANCE"

  // Then transaction-level codes.
  if (transaction === "tx_insufficient_balance") return "INSUFFICIENT_BALANCE"
  if (transaction === "tx_bad_seq") return "SEQUENCE_MISMATCH"
  if (transaction === "tx_insufficient_fee") return "FEE_TOO_LOW"
  if (transaction === "tx_too_late") return "TX_TIMEOUT"
  if (transaction === "tx_no_source_account") return "ACCOUNT_NOT_FOUND"

  // Anything else that is not a success is a failure we cannot name further.
  if (transaction && transaction !== "tx_success") return "TRANSACTION_FAILED"

  return undefined
}

/**
 * Returns `true` if the error is an abort error (user-triggered cancellation).
 * Abort errors are not truly errors — they are deliberate cancellations, and
 * should not be shown to the user as failures.
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const e = error as Error
  return e.name === "AbortError" || e.message?.includes("abort") === true
}

/**
 * Normalize any thrown value into a typed {@link StellarError}.
 *
 * Mapping precedence (most specific first):
 *  0. Abort errors → return null (a deliberate abort is not an error).
 *  1. Already a `StellarError` → returned unchanged.
 *  2. Abort error → returns `null` (deliberate cancellation, not an error).
 *  3. HTTP 504 Gateway Timeout → returns `TX_TIMEOUT` with transaction hash.
 *  4. Horizon `result_codes` — operation codes first, then transaction codes.
 *  5. Horizon problem-details `type` URI (RFC 7807).
 *  6. HTTP status codes (`429` → rate limited, `404` → not found, `5xx`).
 *  7. Wallet message heuristics, anchored to phrases wallets actually emit.
 *  8. Transport/network failure heuristics.
 *  9. Fallback `UNKNOWN`, preserving the original message.
 *
 * Steps 4 to 6 read structured fields. The heuristics below them exist only
 * for errors that carry no structure at all — chiefly wallet extensions, which
 * throw plain `Error`s with no status and no body. They are deliberately
 * narrow: classification by substring is guessing, and a consumer branching on
 * `err.code` renders a wrong UI with full confidence when the guess is wrong.
 */
export function toStellarError(error: unknown): StellarError | null {
  // 0. Abort errors are not errors — they're deliberate cancellations.
  if (isAbortError(error)) {
    return null
  }
  // 1. Pass-through anything already typed.
  if (error instanceof StellarError) {
    return error
  }
  if (isStellarError(error)) {
    // Plain object carrying a known code — normalise to a real instance.
    return new StellarError(error.code, error.message, { raw: error })
  }

  if (
    error &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "WalletAdapterError"
  ) {
    const adapterCode = (error as { code?: unknown }).code
    if (typeof adapterCode === "string" && adapterCode in WALLET_ERROR_CODES) {
      return createStellarError(
        WALLET_ERROR_CODES[adapterCode as WalletAdapterErrorCode],
        error instanceof Error ? error.message : String((error as { message?: unknown }).message),
        { raw: error }
      )
    }
  }

  // 2. Abort errors are not failures — they are deliberate cancellations.
  if (isAbortError(error)) {
    return null
  }

  const rawMessage = error instanceof Error ? error.message : String(error)
  const response = getResponse(error)
  const status = response?.status ?? response?.data?.status
  const resultCodes = response?.data?.extras?.result_codes

  // 3. HTTP 504 Gateway Timeout is a special case: Horizon gave up waiting,
  //    but the transaction may still be in the queue and could succeed.
  //    This is NOT a failure — it is "unknown", and the caller must poll.
  if (status === 504) {
    return createStellarError("TX_TIMEOUT", undefined, { raw: error })
  }

  // 4. Horizon transaction result codes — the most actionable signal.
  if (resultCodes) {
    const code = fromResultCodes(resultCodes)
    if (code) {
      return createStellarError(code, undefined, { raw: error })
    }
  }

  // 5. Problem-details type URI — stable across message rewordings and locales.
  const problemCode = fromProblemType(getProblemType(response))
  if (problemCode) {
    return createStellarError(problemCode, undefined, { raw: error })
  }

  // 6. HTTP status codes.
  if (status === 429) {
    return createStellarError("RATE_LIMITED", undefined, { raw: error })
  }
  if (status === 404) {
    return createStellarError("ACCOUNT_NOT_FOUND", undefined, { raw: error })
  }
  if (typeof status === "number" && status >= 500) {
    // 502/503 are the gateway giving up, not the ledger rejecting anything.
    // They are different from 504: these are immediate failures, whereas 504
    // means "I started the work but gave up waiting for the result".
    return createStellarError("NETWORK_ERROR", undefined, { raw: error })
  }

  // 7. Wallet message heuristics.
  //
  // Only for errors with no structure to read — wallet extensions throw plain
  // `Error`s. The phrases are anchored to what wallets actually emit. A bare
  // "rejected" is deliberately absent: "Transaction rejected by the network"
  // is a network rejection, and reporting it as a user cancellation produces
  // the opposite UI from the one the situation calls for.
  const lower = rawMessage.toLowerCase()
  const isWalletCancellation =
    lower.includes("user declined") ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("request rejected by user") ||
    lower.includes("declined by the user") ||
    lower.includes("rejected by the user") ||
    lower.includes("denied by the user") ||
    lower.includes("user cancelled") ||
    lower.includes("user canceled")

  if (isWalletCancellation) {
    return createStellarError("WALLET_REQUEST_REJECTED", undefined, { raw: error })
  }

  if (
    lower.includes("not installed") ||
    lower.includes("not detected") ||
    (lower.includes("freighter") && lower.includes("not found"))
  ) {
    return createStellarError("WALLET_NOT_INSTALLED", undefined, { raw: error })
  }

  // 8. Transport/network failures (but not timeout messages that might be 504).
  if (
    lower.includes("network error") ||
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("timeout")
  ) {
    return createStellarError("NETWORK_ERROR", undefined, { raw: error })
  }

  // 9. Fallback — keep the original message so nothing is silently swallowed.
  return createStellarError("UNKNOWN", rawMessage || undefined, { raw: error })
}
