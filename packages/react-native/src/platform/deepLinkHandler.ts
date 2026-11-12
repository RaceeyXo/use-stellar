/**
 * #346 — React Native deep-link return handler.
 *
 * On mobile a signing flow can send the user to another app (a wallet) and
 * bring them back through a deep link. This module:
 *
 *   1. Listens for incoming deep-link URLs via `Linking`, including the URL a
 *      cold start was launched with.
 *   2. Parses the embedded result (signed XDR, or an error / cancellation).
 *   3. Resolves the matching promise from {@link registerPendingRequest}.
 *
 * A pending request is a promise, so it lives only as long as the process: if
 * the OS kills the app while the user is in the wallet, there is nothing left
 * to resolve when they return. Pass `onUnmatchedResult` to
 * {@link initDeepLinkHandler} to receive such a result anyway and decide what
 * to do with it.
 *
 * Restoring the wallet session after a restart is not this module's job — the
 * provider's `autoConnect` does that, through the same storage.
 */

import { Linking } from "react-native"

// ─── Pending request registry ─────────────────────────────────────────────────

interface PendingRequest {
  resolve: (signedXdr: string) => void
  reject: (reason: Error) => void
  timeoutHandle: ReturnType<typeof setTimeout>
}

/** How long (ms) a pending sign request waits for a deep-link return. */
const SIGN_REQUEST_TIMEOUT_MS = 5 * 60 * 1_000 // 5 minutes

const pendingRequests = new Map<string, PendingRequest>()

/**
 * Register a pending sign request keyed by a unique `requestId`.
 * Returns a promise that resolves with the signed XDR on success or rejects
 * on timeout / user rejection.
 *
 * The `requestId` is what ties a returning link to this request, and any app
 * on the device can open your URL scheme — so it must be unguessable (a fresh
 * random value per request), never a counter or a timestamp.
 */
export function registerPendingRequest(
  requestId: string,
  options: { timeoutMs?: number } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? SIGN_REQUEST_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`Sign request ${requestId} timed out after ${timeoutMs / 1_000}s`))
    }, timeoutMs)

    pendingRequests.set(requestId, { resolve, reject, timeoutHandle })
  })
}

// ─── Deep-link URL parser ──────────────────────────────────────────────────────

/** What a wallet's callback deep link carried. */
export interface DeepLinkResult {
  requestId: string | null
  signedXdr: string | null
  error: string | null
  cancelled: boolean
}

/** Decodes one query component. A `+` stays a `+`: base64 XDR is full of them. */
function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Standard base64 with correct padding — the encoding of a transaction envelope. */
function isBase64(value: string): boolean {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

/**
 * Parse the wallet's callback deep-link URL.
 *
 * Expected format (example):
 *   `myapp://stellar/signed?requestId=abc123&xdr=AAAA...`
 *   `myapp://stellar/signed?requestId=abc123&error=user_cancelled`
 *
 * The query string is split by hand rather than with `URLSearchParams`: React
 * Native's built-in implementation throws "not implemented" from `get()`, so
 * every link would otherwise parse as empty.
 */
export function parseDeepLink(url: string): DeepLinkResult {
  const result: DeepLinkResult = {
    requestId: null,
    signedXdr: null,
    error: null,
    cancelled: false,
  }

  const queryIndex = url.indexOf("?")
  if (queryIndex === -1) return result

  const fragmentIndex = url.indexOf("#", queryIndex)
  const query = url.slice(queryIndex + 1, fragmentIndex === -1 ? undefined : fragmentIndex)

  const params = new Map<string, string>()
  for (const pair of query.split("&")) {
    if (!pair) continue
    const separator = pair.indexOf("=")
    const key = decodeComponent(separator === -1 ? pair : pair.slice(0, separator))
    const value = separator === -1 ? "" : decodeComponent(pair.slice(separator + 1))
    // First occurrence wins, so a duplicated parameter cannot override it.
    if (!params.has(key)) params.set(key, value)
  }

  result.requestId = params.get("requestId") || null
  result.signedXdr = params.get("xdr") || null
  result.error = params.get("error") || null
  result.cancelled = result.error === "user_cancelled" || params.get("cancelled") === "true"

  return result
}

// ─── Deep-link handler ────────────────────────────────────────────────────────

/** Options for {@link initDeepLinkHandler}. */
export interface DeepLinkHandlerOptions {
  /**
   * Called with a sign-request result that matches no pending request — most
   * often because the app was killed while the user was in the wallet and has
   * just been relaunched by the return link.
   *
   * The link is untrusted input: validate the transaction (for example that
   * it is the one you asked to have signed) before submitting it.
   */
  onUnmatchedResult?: (result: DeepLinkResult) => void
}

/**
 * Handle an incoming deep-link URL. Called from `Linking.addEventListener` and
 * on cold-start via `Linking.getInitialURL()`.
 */
function handleDeepLink(url: string, options: DeepLinkHandlerOptions): void {
  const result = parseDeepLink(url)
  const { requestId, signedXdr, error, cancelled } = result

  if (!requestId) return // not a sign-request callback

  const pending = pendingRequests.get(requestId)
  if (!pending) {
    // Already timed out or resolved — or this process never made the request.
    options.onUnmatchedResult?.(result)
    return
  }

  clearTimeout(pending.timeoutHandle)
  pendingRequests.delete(requestId)

  if (cancelled || error) {
    pending.reject(
      new Error(
        cancelled ? "User cancelled the signing request" : (error ?? "Wallet returned an error")
      )
    )
    return
  }

  if (!signedXdr) {
    pending.reject(new Error("Deep-link callback missing signed XDR"))
    return
  }

  if (!isBase64(signedXdr)) {
    pending.reject(new Error("Deep-link callback carried a malformed signed XDR"))
    return
  }

  pending.resolve(signedXdr)
}

// ─── Public setup API ─────────────────────────────────────────────────────────

let _initialized = false

/**
 * Initialize the deep-link listener and handle any cold-start URL.
 *
 * Call once at app startup (e.g. in your root component's `useEffect`):
 *
 * ```ts
 * import { initDeepLinkHandler } from "@use-stellar/react-native"
 *
 * useEffect(() => {
 *   const cleanup = initDeepLinkHandler()
 *   return cleanup
 * }, [])
 * ```
 */
export function initDeepLinkHandler(options: DeepLinkHandlerOptions = {}): () => void {
  if (_initialized) return () => undefined
  _initialized = true

  let active = true

  // Handle cold-start deep link (app was not running when link fired).
  void Linking.getInitialURL()
    .then(url => {
      if (url && active) handleDeepLink(url, options)
    })
    .catch(() => {
      // No initial URL to handle.
    })

  // Handle warm/hot deep links while the app is running.
  const subscription = Linking.addEventListener("url", ({ url }) => {
    handleDeepLink(url, options)
  })

  return () => {
    active = false
    subscription.remove()
    _initialized = false
  }
}
