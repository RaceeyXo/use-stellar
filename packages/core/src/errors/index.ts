// ── Centralized typed error handling ───────────────────────────────────────
export {
  STELLAR_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  isStellarErrorCode,
  type StellarErrorCode,
} from "./codes"
export { StellarError, isStellarError, type StellarErrorOptions } from "./StellarError"
export { createStellarError, toStellarError, toSubmissionError, isAbortError } from "./factory"
