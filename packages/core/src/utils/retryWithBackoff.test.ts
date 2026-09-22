/**
 * Tests for retryWithBackoff — the 429 / back-off utility.
 *
 * We spy on setTimeout to make sleeps instant instead of using fake timers,
 * which avoids the PromiseRejectionHandledWarning that fake-timer tick-driven
 * tests can trigger when mock-rejected promises are created before being consumed.
 */

import {
  retryWithBackoff,
  isRetriable,
  getRetryAfterMs,
  computeBackoffDelay,
} from "../utils/retryWithBackoff"

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Axios/Horizon-style error with the given HTTP status. */
function httpError(status: number, retryAfter?: string | number) {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    response: {
      status: number
      headers: Record<string, string | number>
      data: { type: string; status: number }
    }
  }
  err.response = {
    status,
    headers: retryAfter !== undefined ? { "retry-after": retryAfter } : {},
    data: {
      type: status === 429 ? "https://stellar.org/horizon-errors/rate_limit_exceeded" : "",
      status,
    },
  }
  return err
}

/** Build a plain network error with no HTTP response. */
function networkError(message = "Network Error") {
  return new Error(message)
}

// Make all sleeps instant so tests don't wait for real back-off delays.
// We do this by replacing setTimeout with an immediate callback instead of
// using fake timers, which avoids unhandled-rejection races with fake-timer ticks.
let setTimeoutSpy: jest.SpyInstance

beforeAll(() => {
  setTimeoutSpy = jest
    .spyOn(global, "setTimeout")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation((fn: any) => {
      fn()
      // Return a fake timer ID (not used by retryWithBackoff)
      return 0 as unknown as ReturnType<typeof setTimeout>
    })
})

afterAll(() => {
  setTimeoutSpy.mockRestore()
})

// ── isRetriable ───────────────────────────────────────────────────────────────

describe("isRetriable", () => {
  it("returns true for 429 (always retriable)", () => {
    expect(isRetriable(httpError(429))).toBe(true)
  })

  it("returns false for 500 by default (retryOn5xx not set)", () => {
    expect(isRetriable(httpError(500))).toBe(false)
  })

  it("returns true for 500 when retryOn5xx is true", () => {
    expect(isRetriable(httpError(500), true)).toBe(true)
  })

  it("returns true for 503 when retryOn5xx is true", () => {
    expect(isRetriable(httpError(503), true)).toBe(true)
  })

  it("returns false for plain network errors by default (retryOn5xx not set)", () => {
    expect(isRetriable(networkError())).toBe(false)
  })

  it("returns true for plain network errors when retryOn5xx is true", () => {
    expect(isRetriable(networkError(), true)).toBe(true)
  })

  it("returns false for 400", () => {
    expect(isRetriable(httpError(400))).toBe(false)
  })

  it("returns false for 404", () => {
    expect(isRetriable(httpError(404))).toBe(false)
  })

  it("returns false for abort errors", () => {
    const abortErr = new DOMException("Aborted", "AbortError")
    expect(isRetriable(abortErr)).toBe(false)
  })

  it("returns false for null / non-object", () => {
    expect(isRetriable(null)).toBe(false)
    expect(isRetriable("string error")).toBe(false)
  })
})

// ── getRetryAfterMs ──────────────────────────────────────────────────────────

describe("getRetryAfterMs", () => {
  it("returns milliseconds for an integer Retry-After header", () => {
    expect(getRetryAfterMs(httpError(429, 5))).toBe(5_000)
  })

  it("returns milliseconds for a string Retry-After header", () => {
    expect(getRetryAfterMs(httpError(429, "10"))).toBe(10_000)
  })

  it("clamps very large values to 60 seconds", () => {
    expect(getRetryAfterMs(httpError(429, 999))).toBe(60_000)
  })

  it("clamps zero / negative to 1 second minimum", () => {
    expect(getRetryAfterMs(httpError(429, 0))).toBe(1_000)
    expect(getRetryAfterMs(httpError(429, -5))).toBe(1_000)
  })

  it("returns null when there is no Retry-After header", () => {
    expect(getRetryAfterMs(httpError(429))).toBeNull()
  })

  it("returns null for plain network errors", () => {
    expect(getRetryAfterMs(networkError())).toBeNull()
  })

  it("returns null for non-numeric Retry-After values", () => {
    expect(getRetryAfterMs(httpError(429, "not-a-number"))).toBeNull()
  })
})

// ── computeBackoffDelay ──────────────────────────────────────────────────────

describe("computeBackoffDelay", () => {
  it("returns a non-negative number", () => {
    for (let i = 0; i < 10; i++) {
      expect(computeBackoffDelay(i)).toBeGreaterThanOrEqual(0)
    }
  })

  it("never exceeds 30 seconds", () => {
    for (let i = 0; i < 20; i++) {
      expect(computeBackoffDelay(i)).toBeLessThanOrEqual(30_000)
    }
  })
})

// ── retryWithBackoff ─────────────────────────────────────────────────────────

describe("retryWithBackoff", () => {
  it("resolves immediately when fn succeeds on the first try", async () => {
    const fn = jest.fn().mockResolvedValue("ok")
    const result = await retryWithBackoff(fn)
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on 429 and resolves after a successful retry", async () => {
    const fn = jest.fn().mockRejectedValueOnce(httpError(429, 1)).mockResolvedValue("recovered")

    const result = await retryWithBackoff(fn, { maxRetries: 3 })
    expect(result).toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries on 500 when retryOn5xx is true", async () => {
    const fn = jest.fn().mockRejectedValueOnce(httpError(500)).mockResolvedValue("back-online")

    expect(await retryWithBackoff(fn, { maxRetries: 3, retryOn5xx: true })).toBe("back-online")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("does NOT retry 500 by default (retryOn5xx not set)", async () => {
    const err = httpError(500)
    const fn = jest.fn().mockRejectedValue(err)

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("exhausts retries and throws the last error", async () => {
    const err = httpError(429, 1)
    const fn = jest
      .fn()
      .mockRejectedValueOnce(httpError(429, 1))
      .mockRejectedValueOnce(httpError(429, 1))
      .mockRejectedValue(err)

    await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toBe(err)
    // 1 initial + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("does NOT retry on 404 (non-retriable error)", async () => {
    const err = httpError(404)
    const fn = jest.fn().mockRejectedValue(err)

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("does NOT retry on 400 (non-retriable error)", async () => {
    const err = httpError(400)
    const fn = jest.fn().mockRejectedValue(err)

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("does NOT retry abort errors", async () => {
    const abortErr = new DOMException("Aborted", "AbortError")
    const fn = jest.fn().mockRejectedValue(abortErr)

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toThrow("Aborted")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("stops retrying when the AbortSignal is already aborted before the first call", async () => {
    const controller = new AbortController()
    controller.abort()

    const fn = jest.fn().mockResolvedValue("ok")
    await expect(retryWithBackoff(fn, { signal: controller.signal })).rejects.toThrow("Aborted")
    expect(fn).toHaveBeenCalledTimes(0)
  })

  it("stops retrying when the AbortSignal fires between attempts", async () => {
    const controller = new AbortController()

    // Abort when the second call would be made
    let callCount = 0
    const fn = jest.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Abort the signal after the first call — abort happens before the retry
        // sleep resolves (which is instant in this test suite via the setTimeout spy)
        controller.abort()
        return Promise.reject(httpError(429, 1))
      }
      return Promise.resolve("should not reach")
    })

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, signal: controller.signal })
    ).rejects.toThrow("Aborted")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries network errors (no HTTP status) when retryOn5xx is true", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(networkError("Failed to fetch"))
      .mockResolvedValue("online")

    expect(await retryWithBackoff(fn, { maxRetries: 3, retryOn5xx: true })).toBe("online")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("does NOT retry network errors by default (retryOn5xx not set)", async () => {
    const err = networkError("Failed to fetch")
    const fn = jest.fn().mockRejectedValue(err)

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("respects maxRetries: 0 (no retries, throw immediately)", async () => {
    const err = httpError(429, 1)
    const fn = jest.fn().mockRejectedValue(err)

    await expect(retryWithBackoff(fn, { maxRetries: 0 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
