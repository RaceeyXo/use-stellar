/**
 * Recorded Horizon error bodies, for classification tests.
 *
 * The `not_found`, `transaction_malformed`, and `bad_request` bodies were
 * captured verbatim from `horizon-testnet.stellar.org`. The `result_codes`
 * bodies follow Horizon's published `transaction_failed` schema — they are not
 * hand-waved shapes but the structure Horizon documents and returns.
 *
 * Everything here is testnet. No mainnet address or transaction appears in
 * this file.
 *
 * These fixtures are meant to be reused: a mock-server test suite can serve
 * them directly rather than inventing its own error bodies.
 */

/** Horizon speaks RFC 7807 problem details on every error response. */
export interface HorizonProblemBody {
  type: string
  title: string
  status: number
  detail: string
  extras?: {
    envelope_xdr?: string
    result_codes?: {
      transaction?: string
      operations?: string[]
    }
    invalid_field?: string
    reason?: string
  }
}

/**
 * Wraps a recorded body in the Axios-shaped error the SDK actually throws, so
 * a test exercises the same extraction path production does.
 */
export function horizonError(body: HorizonProblemBody): Error & {
  response: { status: number; data: HorizonProblemBody }
} {
  const error = new Error(body.title) as Error & {
    response: { status: number; data: HorizonProblemBody }
  }
  error.response = { status: body.status, data: body }
  return error
}

// ── Recorded verbatim from horizon-testnet.stellar.org ─────────────────────

/** GET /accounts/<unfunded account> — the missing-account case. */
export const NOT_FOUND: HorizonProblemBody = {
  type: "https://stellar.org/horizon-errors/not_found",
  title: "Resource Missing",
  status: 404,
  detail:
    "The resource at the url requested was not found.  This usually occurs for one of two reasons:  The url requested is not valid, or no data in our database could be found with the parameters provided.",
}

/** POST /transactions with an undecodable envelope. */
export const TRANSACTION_MALFORMED: HorizonProblemBody = {
  type: "https://stellar.org/horizon-errors/transaction_malformed",
  title: "Transaction Malformed",
  status: 400,
  detail:
    "Horizon could not decode the transaction envelope in this request. A transaction should be an XDR TransactionEnvelope struct encoded using base64.  The envelope read from this request is echoed in the `extras.envelope_xdr` field of this response for your convenience.",
  extras: {
    envelope_xdr: "AAAAAA",
  },
}

/** GET /accounts/<malformed id> — a validation failure, not a missing account. */
export const BAD_REQUEST: HorizonProblemBody = {
  type: "https://stellar.org/horizon-errors/bad_request",
  title: "Bad Request",
  status: 400,
  detail: "The request you sent was invalid in some way.",
  extras: {
    invalid_field: "account_id",
    reason: "Account ID must start with `G` and contain 56 alphanum characters",
  },
}

// ── transaction_failed bodies, per Horizon's published schema ──────────────

function transactionFailed(
  detail: string,
  result_codes: { transaction?: string; operations?: string[] }
): HorizonProblemBody {
  return {
    type: "https://stellar.org/horizon-errors/transaction_failed",
    title: "Transaction Failed",
    status: 400,
    detail,
    extras: { result_codes },
  }
}

/** The sequence number was stale — the account moved on before submission. */
export const TX_BAD_SEQ = transactionFailed(
  "The transaction failed when submitted to the stellar network. The `extras.result_codes` field on this response contains further details.  Descriptions of each code can be found at: https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/http-status-codes/horizon-specific/transaction-failed",
  { transaction: "tx_bad_seq" }
)

/** The bid was below what the network accepted for that ledger. */
export const TX_INSUFFICIENT_FEE = transactionFailed(
  "The transaction failed when submitted to the stellar network. The `extras.result_codes` field on this response contains further details.",
  { transaction: "tx_insufficient_fee" }
)

/** The destination account does not exist on the ledger. */
export const OP_NO_DESTINATION = transactionFailed(
  "The transaction failed when submitted to the stellar network. The `extras.result_codes` field on this response contains further details.",
  { transaction: "tx_failed", operations: ["op_no_destination"] }
)

/** The destination holds no trustline for the asset being sent. */
export const OP_NO_TRUST = transactionFailed(
  "The transaction failed when submitted to the stellar network. The `extras.result_codes` field on this response contains further details.",
  { transaction: "tx_failed", operations: ["op_no_trust"] }
)

/** The source account cannot cover the payment. */
export const OP_UNDERFUNDED = transactionFailed(
  "The transaction failed when submitted to the stellar network. The `extras.result_codes` field on this response contains further details.",
  { transaction: "tx_failed", operations: ["op_underfunded"] }
)

// ── Infrastructure responses ───────────────────────────────────────────────

/** Horizon rate limiting. */
export const RATE_LIMIT_EXCEEDED: HorizonProblemBody = {
  type: "https://stellar.org/horizon-errors/rate_limit_exceeded",
  title: "Rate Limit Exceeded",
  status: 429,
  detail:
    "The rate limit for the requesting IP address is over its allowed limit. The rate limit is reset every hour.",
}

/** The gateway gave up waiting for the ledger — not a ledger-level rejection. */
export const TIMEOUT: HorizonProblemBody = {
  type: "https://stellar.org/horizon-errors/timeout",
  title: "Timeout",
  status: 504,
  detail:
    "Your request timed out before completing.  Please try your request again. If you are submitting a transaction be sure you are periodically checking by transaction hash that the transaction has not completed.",
}

/** Horizon shedding load. */
export const SERVER_OVER_CAPACITY: HorizonProblemBody = {
  type: "https://stellar.org/horizon-errors/server_over_capacity",
  title: "Server Over Capacity",
  status: 503,
  detail:
    "This horizon server is currently overloaded.  Please wait for a second and then try your request again.",
}
