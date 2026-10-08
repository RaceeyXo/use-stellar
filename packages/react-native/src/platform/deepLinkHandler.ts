/**
 * #346 — React Native deep-link return handler and session resume.
 *
 * On mobile the signing flow sends the user to another app (e.g. Freighter
 * Mobile, Rabet, WalletConnect). When they return the originating app may have
 * been backgrounded or killed. This module:
 *
 *   1. Listens for incoming deep-link URLs via `Linking.addEventListener`.
 *   2. Parses the embedded transaction result (signed XDR, or error / rejection).
 *   3. Resolves the matching pending promise from `PendingRequestRegistry`.
 *   4. Restores the wallet session from `AsyncStorage` so the user is not
 *      prompted to reconnect.
 */

import { Linking } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// ─── Pending request registry ─────────────────────────────────────────────────

interface PendingRequest {
  resolve: (signedXdr: string) => void
  reject: (reason: Error) => void
  /** Optional timeout handle so stale requests are cleaned up. */
  timeoutHandle?: ReturnType<typeof setTimeout>
}

/** How long (ms) a pending sign request waits for a deep-link return. */
const SIGN_REQUEST_TIMEOUT_MS = 5 * 60 * 1_000 // 5 minutes

const pendingRequests = new Map<string, PendingRequest>()

/**
 * Register a pending sign request keyed by a unique `requestId`.
 * Returns a promise that resolves with the signed XDR on success or rejects
 * on timeout / user rejection.
 */
export function registerPendingRequest(requestId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(
        new Error(`Sign request ${requestId} timed out after ${SIGN_REQUEST_TIMEOUT_MS / 1_000}s`)
      )
    }, SIGN_REQUEST_TIMEOUT_MS)

    pendingRequests.set(requestId, { resolve, reject, timeoutHandle })
  })
}

// ─── Session persistence ───────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = "use-stellar:session"

export interface WalletSession {
  publicKey: string
  walletType: string
  connectedAt: number
}

/** Persist the current wallet session so it can be restored after backgrounding. */
export async function persistSession(session: WalletSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

/** Restore a previously persisted session, or return `null` if none exists. */
export async function restoreSession(): Promise<WalletSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WalletSession
  } catch {
    return null
  }
}

/** Clear the stored session on explicit disconnect. */
export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY)
}

// ─── Deep-link URL parser ──────────────────────────────────────────────────────

interface DeepLinkResult {
  requestId: string | null
  signedXdr: string | null
  error: string | null
  cancelled: boolean
}

/**
 * Parse the wallet's callback deep-link URL.
 *
 * Expected format (example):
 *   `myapp://stellar/signed?requestId=abc123&xdr=AAAA...`
 *   `myapp://stellar/signed?requestId=abc123&error=user_cancelled`
 */
function parseDeepLink(url: string): DeepLinkResult {
  const result: DeepLinkResult = {
    requestId: null,
    signedXdr: null,
    error: null,
    cancelled: false,
  }
  try {
    // React Native's URL may not support all platforms; use manual parsing.
    const queryIndex = url.indexOf("?")
    if (queryIndex === -1) return result

    const queryString = url.slice(queryIndex + 1)
    const params = new URLSearchParams(queryString)

    result.requestId = params.get("requestId")
    result.signedXdr = params.get("xdr")
    result.error = params.get("error")
    result.cancelled =
      params.get("error") === "user_cancelled" || params.get("cancelled") === "true"
  } catch {
    // Malformed URL — return empty result; the handler will reject or ignore.
  }
  return result
}

// ─── Deep-link handler ────────────────────────────────────────────────────────

/**
 * Handle an incoming deep-link URL. Called from `Linking.addEventListener` and
 * on cold-start via `Linking.getInitialURL()`.
 */
async function handleDeepLink(url: string): Promise<void> {
  const { requestId, signedXdr, error, cancelled } = parseDeepLink(url)

  if (!requestId) return // not a sign-request callback

  const pending = pendingRequests.get(requestId)
  if (!pending) return // already timed out or resolved

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
export function initDeepLinkHandler(): () => void {
  if (_initialized) return () => undefined
  _initialized = true

  // Handle cold-start deep link (app was not running when link fired).
  void Linking.getInitialURL().then(url => {
    if (url) void handleDeepLink(url)
  })

  // Handle warm/hot deep links while the app is running.
  const subscription = Linking.addEventListener("url", ({ url }) => {
    void handleDeepLink(url)
  })

  return () => {
    subscription.remove()
    _initialized = false
  }
}
