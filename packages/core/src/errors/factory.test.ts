import {
  createStellarError,
  toStellarError,
  toSubmissionError,
  StellarError,
  isStellarError,
  isStellarErrorCode,
  DEFAULT_ERROR_MESSAGES,
  STELLAR_ERROR_CODES,
} from "./index"
import * as fixtures from "../__tests__/fixtures/horizon-errors"
import { horizonError as fixtureError } from "../__tests__/fixtures/horizon-errors"

// Helper to fabricate a Horizon/Axios style error.
function horizonError(options: {
  status?: number
  resultCodes?: { transaction?: string; operations?: string[] }
  message?: string
}) {
  return {
    message: options.message ?? "Request failed",
    response: {
      status: options.status,
      data: options.resultCodes ? { extras: { result_codes: options.resultCodes } } : undefined,
    },
  }
}

describe("StellarError class", () => {
  it("is a real Error subclass that can be thrown and caught", () => {
    expect(() => {
      throw createStellarError("WALLET_NOT_CONNECTED")
    }).toThrow(StellarError)

    const err = createStellarError("WALLET_NOT_CONNECTED")
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StellarError)
    expect(err.name).toBe("StellarError")
  })

  it("uses the default message when none is provided", () => {
    const err = createStellarError("NO_TRUSTLINE")
    expect(err.code).toBe("NO_TRUSTLINE")
    expect(err.message).toBe(DEFAULT_ERROR_MESSAGES.NO_TRUSTLINE)
  })

  it("keeps a custom message and the raw cause", () => {
    const raw = new Error("boom")
    const err = createStellarError("WRONG_NETWORK", "Switch to testnet", { raw })
    expect(err.message).toBe("Switch to testnet")
    expect(err.raw).toBe(raw)
  })
})

describe("isStellarError / isStellarErrorCode", () => {
  it("recognises real instances and plain objects with a known code", () => {
    expect(isStellarError(createStellarError("UNKNOWN"))).toBe(true)
    expect(isStellarError({ code: "RATE_LIMITED", message: "slow down" })).toBe(true)
  })

  it("rejects unrelated objects (e.g. an Axios error with its own code)", () => {
    expect(isStellarError({ code: "ERR_BAD_REQUEST", message: "nope" })).toBe(false)
    expect(isStellarError(new Error("plain"))).toBe(false)
    expect(isStellarError(null)).toBe(false)
  })

  it("validates error codes", () => {
    expect(isStellarErrorCode("NETWORK_ERROR")).toBe(true)
    expect(isStellarErrorCode("NOT_A_CODE")).toBe(false)
    expect(Object.keys(STELLAR_ERROR_CODES)).toContain("RATE_LIMITED")
  })
})

describe("toStellarError — Horizon result codes", () => {
  it("maps op_no_trust → NO_TRUSTLINE", () => {
    const err = toStellarError(
      horizonError({ status: 400, resultCodes: { operations: ["op_no_trust"] } })
    )
    expect(err).not.toBeNull()
    expect(err!.code).toBe("NO_TRUSTLINE")
    expect(err!.message).toBe(DEFAULT_ERROR_MESSAGES.NO_TRUSTLINE)
  })

  it("maps op_underfunded → INSUFFICIENT_BALANCE", () => {
    const err = toStellarError(
      horizonError({ status: 400, resultCodes: { operations: ["op_underfunded"] } })
    )
    expect(err).not.toBeNull()
    expect(err!.code).toBe("INSUFFICIENT_BALANCE")
  })

  it("maps tx_insufficient_balance → INSUFFICIENT_BALANCE", () => {
    const err = toStellarError(
      horizonError({ status: 400, resultCodes: { transaction: "tx_insufficient_balance" } })
    )
    expect(err).not.toBeNull()
    expect(err!.code).toBe("INSUFFICIENT_BALANCE")
  })

  it("maps a generic failed transaction → TRANSACTION_FAILED", () => {
    const err = toStellarError(
      horizonError({
        status: 400,
        resultCodes: { transaction: "tx_failed", operations: ["op_bad_auth"] },
      })
    )
    expect(err).not.toBeNull()
    expect(err!.code).toBe("TRANSACTION_FAILED")
  })

  it("prioritises operation codes over the transaction code", () => {
    const err = toStellarError(
      horizonError({
        status: 400,
        resultCodes: { transaction: "tx_failed", operations: ["op_no_trust"] },
      })
    )
    expect(err).not.toBeNull()
    expect(err!.code).toBe("NO_TRUSTLINE")
  })
})

describe("toSubmissionError", () => {
  it("classifies failed submissions and preserves the transaction hash", () => {
    const error = toSubmissionError({
      hash: "failed_tx_hash",
      extras: { result_codes: { operations: ["op_no_trust"] } },
    })

    expect(error.code).toBe("NO_TRUSTLINE")
    expect(error.hash).toBe("failed_tx_hash")
  })
})

describe("toStellarError — HTTP status codes", () => {
  it("maps 429 → RATE_LIMITED", () => {
    const err = toStellarError(horizonError({ status: 429 }))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("RATE_LIMITED")
  })

  it("maps a 404 status → ACCOUNT_NOT_FOUND", () => {
    const err = toStellarError(horizonError({ status: 404 }))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("ACCOUNT_NOT_FOUND")
  })

  it("does not classify a status-less message containing '404' as ACCOUNT_NOT_FOUND", () => {
    // A message that merely mentions 404 is not evidence of a missing account.
    // Matching on it turned CORS failures, stack traces with line 404, and
    // wrapped errors quoting an unrelated 404 into "account not found".
    const err = toStellarError(new Error("Request failed with status code 404"))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("UNKNOWN")
  })
})

describe("toStellarError — wallet heuristics", () => {
  it.each([
    "User declined access",
    "Request was rejected by the user",
    "User rejected the request",
    "User denied the signature request",
    "User cancelled the request",
  ])("maps %p → WALLET_REQUEST_REJECTED", message => {
    const err = toStellarError(new Error(message))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("WALLET_REQUEST_REJECTED")
  })

  it.each(["Freighter is not installed", "Wallet not detected", "Freighter wallet not found"])(
    "maps %p → WALLET_NOT_INSTALLED",
    message => {
      const err = toStellarError(new Error(message))
      expect(err).not.toBeNull()
      expect(err!.code).toBe("WALLET_NOT_INSTALLED")
    }
  )
})

describe("toStellarError — network heuristics", () => {
  it.each([
    "Network Error",
    "Network request failed",
    "Failed to fetch",
    "connect ECONNREFUSED 127.0.0.1:443",
    "socket hang up timeout",
  ])("maps %p → NETWORK_ERROR", message => {
    const err = toStellarError(new Error(message))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("NETWORK_ERROR")
  })
})

describe("toStellarError — fallback & pass-through", () => {
  it("falls back to UNKNOWN while preserving the original message", () => {
    const err = toStellarError(new Error("something weird happened"))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("UNKNOWN")
    expect(err!.message).toBe("something weird happened")
  })

  it("stringifies non-Error throws under UNKNOWN", () => {
    const err1 = toStellarError("boom")
    expect(err1).not.toBeNull()
    expect(err1!.code).toBe("UNKNOWN")
    expect(err1!.message).toBe("boom")
  })

  it("returns an existing StellarError instance unchanged", () => {
    const original = createStellarError("WRONG_NETWORK", "switch")
    expect(toStellarError(original)).toBe(original)
  })

  it("normalises a plain StellarError-shaped object into a real instance", () => {
    const plain = { code: STELLAR_ERROR_CODES.RATE_LIMITED, message: "slow down", raw: 1 }
    const err = toStellarError(plain)
    expect(err).not.toBeNull()
    expect(err).toBeInstanceOf(StellarError)
    expect(err!.code).toBe("RATE_LIMITED")
    expect(err!.message).toBe("slow down")
    expect(err!.raw).toBe(plain)
  })

  it("does not misclassify an Axios error whose code is not a StellarErrorCode", () => {
    const axiosLike = { code: "ERR_BAD_RESPONSE", message: "Some odd failure" }
    const err = toStellarError(axiosLike)
    expect(err).not.toBeNull()
    expect(err!.code).toBe("UNKNOWN")
  })

  it("always attaches the raw error for debugging", () => {
    const raw = horizonError({ status: 429 })
    const err = toStellarError(raw)
    expect(err).not.toBeNull()
    expect(err!.raw).toBe(raw)
  })
})

// ── Classification against recorded Horizon bodies ─────────────────────────
describe("toStellarError — recorded Horizon responses", () => {
  it("classifies a real 404 body from its problem-details type", () => {
    const err = toStellarError(fixtureError(fixtures.NOT_FOUND))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("ACCOUNT_NOT_FOUND")
  })

  it("maps op_no_destination → DESTINATION_NOT_FOUND", () => {
    const err = toStellarError(fixtureError(fixtures.OP_NO_DESTINATION))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("DESTINATION_NOT_FOUND")
  })

  it("maps tx_bad_seq → SEQUENCE_MISMATCH", () => {
    const err = toStellarError(fixtureError(fixtures.TX_BAD_SEQ))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("SEQUENCE_MISMATCH")
  })

  it("maps tx_insufficient_fee → FEE_TOO_LOW, not the generic failure", () => {
    const err = toStellarError(fixtureError(fixtures.TX_INSUFFICIENT_FEE))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("FEE_TOO_LOW")
  })

  it("maps op_no_trust → NO_TRUSTLINE", () => {
    const err = toStellarError(fixtureError(fixtures.OP_NO_TRUST))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("NO_TRUSTLINE")
  })

  it("maps op_underfunded → INSUFFICIENT_BALANCE", () => {
    const err = toStellarError(fixtureError(fixtures.OP_UNDERFUNDED))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("INSUFFICIENT_BALANCE")
  })

  it("maps a rate-limit body → RATE_LIMITED", () => {
    const err = toStellarError(fixtureError(fixtures.RATE_LIMIT_EXCEEDED))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("RATE_LIMITED")
  })

  it("maps a gateway timeout → NETWORK_ERROR, not a ledger failure", () => {
    const err = toStellarError(fixtureError(fixtures.TIMEOUT))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("NETWORK_ERROR")
  })

  it("maps server-over-capacity → NETWORK_ERROR", () => {
    const err = toStellarError(fixtureError(fixtures.SERVER_OVER_CAPACITY))
    expect(err).not.toBeNull()
    expect(err!.code).toBe("NETWORK_ERROR")
  })

  it("does not mistake a malformed-transaction body for a missing account", () => {
    const err = toStellarError(fixtureError(fixtures.TRANSACTION_MALFORMED))
    expect(err).not.toBeNull()
    expect(err!.code).not.toBe("ACCOUNT_NOT_FOUND")
  })

  it("does not mistake a bad-request body for a missing account", () => {
    const err = toStellarError(fixtureError(fixtures.BAD_REQUEST))
    expect(err).not.toBeNull()
    expect(err!.code).not.toBe("ACCOUNT_NOT_FOUND")
  })

  it("preserves the original error on `raw` for every classification", () => {
    const original = fixtureError(fixtures.TX_BAD_SEQ)
    const err = toStellarError(original)
    expect(err).not.toBeNull()
    expect(err!.raw).toBe(original)
  })
})

// ── The substring traps this issue exists to close ─────────────────────────
describe("toStellarError — substring traps", () => {
  it.each([
    "CORS request to https://example.com/assets/404.png was blocked",
    "TypeError: undefined is not a function\n    at Module._compile (module.js:404:12)",
    'Wrapped: inner service replied "404 not found" for an unrelated resource',
  ])("does not classify %p as ACCOUNT_NOT_FOUND", message => {
    const err = toStellarError(new Error(message))
    expect(err).not.toBeNull()
    expect(err!.code).not.toBe("ACCOUNT_NOT_FOUND")
  })

  it.each([
    "Transaction rejected by the network",
    "Connection rejected",
    "The peer rejected the handshake",
  ])("does not classify %p as a wallet cancellation", message => {
    // A network rejection and a user cancellation need opposite UI: one is
    // "try again", the other is "you cancelled".
    const err = toStellarError(new Error(message))
    expect(err).not.toBeNull()
    expect(err!.code).not.toBe("WALLET_REQUEST_REJECTED")
  })

  it("still classifies a real wallet cancellation", () => {
    const err1 = toStellarError(new Error("User declined access"))
    expect(err1).not.toBeNull()
    expect(err1!.code).toBe("WALLET_REQUEST_REJECTED")

    const err2 = toStellarError(new Error("User rejected the request"))
    expect(err2).not.toBeNull()
    expect(err2!.code).toBe("WALLET_REQUEST_REJECTED")
  })

  it("reads structured fields even when the message would mislead", () => {
    // The message says "rejected", but the body says the sequence was stale.
    const error = fixtureError(fixtures.TX_BAD_SEQ)
    error.message = "Transaction rejected"

    const err = toStellarError(error)
    expect(err).not.toBeNull()
    expect(err!.code).toBe("SEQUENCE_MISMATCH")
  })
})
