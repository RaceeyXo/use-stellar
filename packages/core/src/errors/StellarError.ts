import { DEFAULT_ERROR_MESSAGES, isStellarErrorCode, type StellarErrorCode } from "./codes"

/** Options accepted when constructing a {@link StellarError}. */
export interface StellarErrorOptions {
  /** The original, unprocessed error (Horizon response, Freighter error, …). */
  raw?: unknown
  /** The transaction hash associated with a failed submission, when available. */
  hash?: string
}

/**
 * A typed error with a stable {@link StellarErrorCode} and a human-readable
 * message. Extends the native `Error` so it can be thrown, caught, logged, and
 * checked with `instanceof` while still exposing `.code` for programmatic
 * handling and `.message` for display.
 */
export class StellarError extends Error {
  /** Stable, machine-readable classification of the failure. */
  readonly code: StellarErrorCode
  /** The original error this was derived from, for debugging. */
  readonly raw?: unknown
  /** The transaction hash associated with the error, when available. */
  readonly hash?: string

  constructor(code: StellarErrorCode, message?: string, options: StellarErrorOptions = {}) {
    super(message ?? DEFAULT_ERROR_MESSAGES[code])
    this.name = "StellarError"
    this.code = code
    this.raw = options.raw
    this.hash = options.hash
    // Restore the prototype chain when targeting ES5 / down-leveled output so
    // `instanceof StellarError` keeps working.
    Object.setPrototypeOf(this, StellarError.prototype)
  }
}

/**
 * Type guard for {@link StellarError}. Recognises both real instances and
 * plain objects that carry a known {@link StellarErrorCode} (e.g. after the
 * error has crossed a serialization boundary).
 */
export function isStellarError(value: unknown): value is StellarError {
  if (value instanceof StellarError) return true
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    isStellarErrorCode((value as { code: unknown }).code)
  )
}
