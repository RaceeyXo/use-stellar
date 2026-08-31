/**
 * Stable, machine-readable error codes shared across every use-stellar hook.
 *
 * Codes are grouped by failure domain so consumers can branch on a category
 * (e.g. anything starting with `WALLET_`) or on a single code. The string
 * values are part of the public contract — never rename an existing one.
 */
export const STELLAR_ERROR_CODES = {
  // ── Wallet ─────────────────────────────────────────────────────────────
  /** Freighter (or the selected wallet) is not installed / not detected. */
  WALLET_NOT_INSTALLED: "WALLET_NOT_INSTALLED",
  /** An action required a connected wallet but none was connected. */
  WALLET_NOT_CONNECTED: "WALLET_NOT_CONNECTED",
  /** The user rejected the request in their wallet. */
  WALLET_REQUEST_REJECTED: "WALLET_REQUEST_REJECTED",
  /** The wallet is connected to a different network than the provider. */
  WRONG_NETWORK: "WRONG_NETWORK",
  WALLET_UNSUPPORTED: "WALLET_UNSUPPORTED",
  SIGNING_FAILED: "SIGNING_FAILED",

  // ── Horizon / transaction ──────────────────────────────────────────────
  /** The requested account or resource does not exist on the ledger (404). */
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  /** The source account lacks the funds to complete the operation. */
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  /** The destination does not hold a trustline for the asset. */
  NO_TRUSTLINE: "NO_TRUSTLINE",
  /** The transaction was submitted but failed on the network. */
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  /** The destination account does not exist on the ledger. */
  DESTINATION_NOT_FOUND: "DESTINATION_NOT_FOUND",
  /** The transaction's sequence number did not match the source account's. */
  SEQUENCE_MISMATCH: "SEQUENCE_MISMATCH",
  TRUSTLINE_LIMIT_EXCEEDED: "TRUSTLINE_LIMIT_EXCEEDED",
  SIMULATION_FAILED: "SIMULATION_FAILED",
  ASSET_NOT_FOUND: "ASSET_NOT_FOUND",
  /** The bid was below what the network accepted for this ledger. */
  FEE_TOO_LOW: "FEE_TOO_LOW",
  /** Horizon timed out while waiting for the transaction to be included in a ledger (504). The transaction may still succeed. Poll with the transaction hash to determine the outcome. */
  TX_TIMEOUT: "TX_TIMEOUT",
  /** The requested ledger range predates what the RPC server still retains. */
  LEDGER_OUT_OF_RETENTION: "LEDGER_OUT_OF_RETENTION",
  /** Horizon rate-limited the request (429). */
  RATE_LIMITED: "RATE_LIMITED",

  // ── Validation ─────────────────────────────────────────────────────────
  /** Caller-supplied input was invalid or the environment was unsupported. */
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // ── Network ────────────────────────────────────────────────────────────
  /** A transport-level failure (offline, DNS, timeout, CORS, etc.). */
  NETWORK_ERROR: "NETWORK_ERROR",

  // ── Fallback ───────────────────────────────────────────────────────────
  /** Anything we could not confidently classify. */
  UNKNOWN: "UNKNOWN",
  ALREADY_FUNDED: "ALREADY_FUNDED",
} as const

/** The union of every supported {@link STELLAR_ERROR_CODES} value. */
export type StellarErrorCode = (typeof STELLAR_ERROR_CODES)[keyof typeof STELLAR_ERROR_CODES]

/** Default human-readable message for each code, shown directly in demos. */
export const DEFAULT_ERROR_MESSAGES: Record<StellarErrorCode, string> = {
  WALLET_NOT_INSTALLED: "Freighter wallet is not installed or could not be detected.",
  WALLET_NOT_CONNECTED: "Wallet is not connected. Connect a wallet and try again.",
  WALLET_REQUEST_REJECTED: "The request was rejected in the wallet.",
  WRONG_NETWORK: "The wallet is connected to the wrong network.",
  WALLET_UNSUPPORTED: "This wallet is not supported by use-stellar.",
  SIGNING_FAILED: "The wallet could not sign the transaction.",
  ACCOUNT_NOT_FOUND: "The requested account or resource could not be found on the ledger.",
  INSUFFICIENT_BALANCE: "The account does not have sufficient funds to complete this transaction.",
  NO_TRUSTLINE: "The destination account does not trust the asset you are trying to send.",
  TRANSACTION_FAILED: "The transaction failed on the network.",
  ALREADY_FUNDED: "This account is already funded on the test network.",
  DESTINATION_NOT_FOUND:
    "The destination account does not exist on this network. It must be created and funded before it can receive a payment.",
  SEQUENCE_MISMATCH:
    "The transaction's sequence number was out of date. Reload the source account and rebuild the transaction.",
  TRUSTLINE_LIMIT_EXCEEDED: "The recipient has reached the maximum trust limit for this asset.",
  SIMULATION_FAILED: "The Soroban transaction could not be simulated successfully.",
  ASSET_NOT_FOUND: "The requested asset could not be found on the ledger.",
  FEE_TOO_LOW:
    "The fee was too low for the current network conditions. Retry with a higher fee or feeMultiplier.",
  TX_TIMEOUT:
    "Horizon timed out before confirming whether the transaction was included in a ledger. The transaction may still have succeeded. Use the transaction hash to poll for the actual outcome.",
  LEDGER_OUT_OF_RETENTION:
    "The requested start ledger is older than this RPC server retains. Use a more recent ledger, or an archival RPC provider.",
  RATE_LIMITED: "Too many requests were sent to Horizon. Please slow down and try again.",
  VALIDATION_ERROR: "The provided input is invalid.",
  NETWORK_ERROR: "Unable to reach the Stellar network. Check your connection and try again.",
  UNKNOWN: "An unknown error occurred.",
}

/** Type guard: is `value` one of the known {@link StellarErrorCode}s? */
export function isStellarErrorCode(value: unknown): value is StellarErrorCode {
  return typeof value === "string" && value in DEFAULT_ERROR_MESSAGES
}
