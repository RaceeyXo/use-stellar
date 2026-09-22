/**
 * Retry-with-backoff logic for Horizon HTTP requests.
 *
 * Behaviour:
 * - On a 429 response, reads the `Retry-After` header and waits exactly that
 *   many seconds before retrying (minimum 1 s, maximum 60 s).
 * - On any other retriable error, uses exponential backoff with full jitter:
 *   `rand(0, min(cap, base * 2^attempt))` to prevent thundering herds.
 * - Non-retriable errors (e.g. 400, 404) are thrown immediately without retry.
 * - Abort-signal errors are rethrown immediately so callers can cancel cleanly.
 */

/** The minimum and maximum caps for the exponential back-off (in ms). */
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 30_000

/**
 * Returns true for HTTP status codes that are safe to retry.
 * 429 = rate limited, 5xx = server/gateway errors (only when retryOn5xx is true).
 * 404, 400, etc. are permanent and should not be retried.
 *
 * @param error - The error to inspect
 * @param retryOn5xx - When true, also retry 5xx errors and plain network failures.
 *                    Defaults to false (only 429 is retried by default).
 */
export function isRetriable(error: unknown, retryOn5xx = false): boolean {
  if (!error || typeof error !== "object") return false

  // Abort errors are deliberate cancellations — never retry.
  const e = error as Error
  if (e.name === "AbortError" || e.message?.includes("abort")) return false

  const status = getErrorStatus(error)
  if (status === undefined) {
    // No HTTP status — likely a network/transport failure (ECONNREFUSED, DNS, etc.)
    return retryOn5xx
  }
  if (status === 429) return true
  // 5xx are retriable only when opted in.
  return retryOn5xx && status >= 500
}

/**
 * Read the `Retry-After` header from a 429 error, if present.
 * Returns the number of **milliseconds** to wait, or `null` if unavailable.
 *
 * Horizon sends an integer number of seconds in `Retry-After`.
 */
export function getRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== "object") return null

  // Horizon / axios attach the response under `error.response`
  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== "object") return null

  const headers = (response as { headers?: unknown }).headers
  if (!headers || typeof headers !== "object") return null

  const retryAfter = (headers as Record<string, unknown>)["retry-after"]
  if (retryAfter === undefined || retryAfter === null) return null

  const seconds = Number(retryAfter)
  if (!Number.isFinite(seconds)) return null

  // Clamp between 1 and 60 seconds to prevent absurd waits (including 0 / negative).
  const clamped = Math.min(Math.max(seconds, 1), 60)
  return clamped * 1_000
}

/**
 * Extract the HTTP status code from an Axios/Horizon-style error object.
 */
function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== "object") return undefined
  const status = (response as { status?: unknown }).status
  if (typeof status === "number") return status
  // Horizon sometimes puts the status in data.status (problem details)
  const data = (response as { data?: unknown }).data
  if (data && typeof data === "object") {
    const dataStatus = (data as { status?: unknown }).status
    if (typeof dataStatus === "number") return dataStatus
  }
  return undefined
}

/**
 * Compute the delay (in ms) for attempt `n` using full-jitter exponential
 * back-off: `rand(0, min(MAX_DELAY_MS, BASE_DELAY_MS * 2^n))`.
 */
export function computeBackoffDelay(attempt: number): number {
  const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, attempt))
  return Math.floor(Math.random() * cap)
}

/** Promise-based sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** A promise that resolves when the abort signal fires (never rejects). */
function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise<void>(resolve => {
    if (signal.aborted) {
      resolve()
      return
    }
    signal.addEventListener("abort", () => resolve(), { once: true })
  })
}

export interface RetryOptions {
  /**
   * Maximum number of **additional** attempts after the first failure.
   * Total attempts = maxRetries + 1.
   * Default: 3.
   */
  maxRetries?: number
  /**
   * When true, also retry on 5xx server errors and plain network failures
   * (ECONNREFUSED, DNS, etc.). By default only 429 responses are retried
   * because 5xx/network retries can mask real failures and break existing
   * error-handling assumptions.
   * Default: false.
   */
  retryOn5xx?: boolean
  /**
   * Optional signal to abort pending retries (e.g. component unmount).
   * When the signal fires, the in-flight retry is abandoned.
   */
  signal?: AbortSignal
}

/**
 * Wraps an async function with retry-and-backoff logic suited for Horizon.
 *
 * By default only retries HTTP 429 (rate-limited) errors. Pass `retryOn5xx: true`
 * to also retry 5xx server errors and plain network failures.
 *
 * ```ts
 * const data = await retryWithBackoff(() => server.loadAccount(address), { maxRetries: 3 })
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, retryOn5xx = false, signal } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Honour abort before attempting.
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }

    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Abort errors are not retriable — surface immediately.
      if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("abort"))) {
        throw err
      }

      const isLast = attempt === maxRetries
      if (isLast || !isRetriable(err, retryOn5xx)) {
        throw err
      }

      // Determine how long to wait before the next attempt.
      const retryAfterMs = getRetryAfterMs(err)
      const delayMs = retryAfterMs !== null ? retryAfterMs : computeBackoffDelay(attempt)

      // Wait, but bail early if the signal fires.
      if (signal) {
        // Race the sleep against the abort signal. We use a "resolve-on-abort"
        // pattern so neither promise in the race ever rejects — avoiding
        // unhandled-rejection warnings.
        let aborted = false
        await Promise.race([
          sleep(delayMs),
          waitForAbort(signal).then(() => {
            aborted = true
          }),
        ])
        if (aborted || signal.aborted) {
          throw new DOMException("Aborted", "AbortError")
        }
      } else {
        await sleep(delayMs)
      }
    }
  }

  // Should be unreachable, but TypeScript needs the explicit throw.
  throw lastError
}
