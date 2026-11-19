/**
 * Framework-neutral wallet session persistence utilities.
 *
 * Provides safe, storage-interface-based session serialization and restoration
 * that works in Node.js (with mocked storage) and browsers, without importing
 * `localStorage` directly or relying on component lifecycles.
 *
 * Only public keys and wallet identifiers are persisted — no keys, tokens, or
 * signing material. Stored values are validated before use and treated as
 * attacker-influenced input in XSS scenarios.
 */

import type { AutoConnectOptions, SessionStorageAdapter } from "../types"
import { hasWalletAdapter } from "../wallets"

/** The persisted wallet session shape — nothing here is secret. */
export interface PersistedWalletSession {
  wallet: string
  address?: string
  /**
   * The chain this session was established on (e.g., "stellar:testnet").
   * Used to detect and restore wrong-chain sessions with intent only.
   * Optional for backwards compatibility; old sessions without this field
   * are treated as chain-agnostic.
   */
  chain?: string
}

/**
 * Storage interface for reading/writing the persisted session. Methods may be
 * synchronous (`localStorage`) or asynchronous (React Native `AsyncStorage`).
 */
export type WalletSessionStorage = SessionStorageAdapter

/** Session persistence key — exported for backwards compatibility. */
export const WALLET_SESSION_STORAGE_KEY = "use-stellar:wallet-session"

/**
 * Returns a storage adapter for the given kind, or `null` if storage is
 * unavailable (SSR, sandboxed iframe, or private mode). A custom adapter is
 * returned as-is, so non-browser runtimes can persist sessions too.
 *
 * Accessing storage itself may throw in sandboxed contexts, not just reading
 * from it, so the result is wrapped in a try/catch.
 *
 * @internal Used by session utilities and hooks.
 */
export function getWalletSessionStorage(
  kind: AutoConnectOptions["storage"] = "local"
): WalletSessionStorage | null {
  if (kind && typeof kind === "object") return kind

  // Safe to check globalThis.window in Node (it's undefined) and in browsers
  const hasWindow = typeof globalThis !== "undefined" && globalThis.window !== undefined

  if (!hasWindow) return null

  try {
    // Accessing `localStorage` or `sessionStorage` itself throws in sandboxed
    // iframes and some private-mode contexts — not just reading from it.
    return kind === "session" ? globalThis.window.sessionStorage : globalThis.window.localStorage
  } catch {
    return null
  }
}

/**
 * Reads and validates the persisted wallet session.
 *
 * A stored value is attacker-influenced input in an XSS scenario, so it is
 * validated before it ever reaches the registry:
 * - Must be valid JSON
 * - Must be an object with a `wallet` string property
 * - The wallet must be registered (known to the adapter registry)
 * - The optional `address` must be a string
 *
 * Returns `null` if:
 * - Storage is unavailable
 * - No session is stored
 * - The stored value is malformed or invalid
 *
 * @param kind Where to read from: `"local"` for localStorage, `"session"` for sessionStorage, or a custom adapter.
 */
export async function readWalletSession(
  kind: AutoConnectOptions["storage"] = "local"
): Promise<PersistedWalletSession | null> {
  const storage = getWalletSessionStorage(kind)
  if (!storage) return null

  try {
    const raw = await storage.getItem(WALLET_SESSION_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null

    const { wallet, address, chain } = parsed as Record<string, unknown>
    if (typeof wallet !== "string" || !hasWalletAdapter(wallet)) return null

    return {
      wallet,
      address: typeof address === "string" ? address : undefined,
      chain: typeof chain === "string" ? chain : undefined,
    }
  } catch {
    // Malformed JSON, parse error, or storage access failed.
    // Losing the ability to restore a session is not an error.
    return null
  }
}

/**
 * Writes a wallet session to storage, or clears it if `null`.
 *
 * Storage quota exceeded or disabled mid-session is not an error — losing the
 * ability to restore a session must never break the app. Exceptions are
 * silently caught.
 *
 * @param kind Where to write: `"local"` for localStorage, `"session"` for sessionStorage, or a custom adapter.
 * @param session The session to persist, or `null` to clear the stored session.
 */
export async function writeWalletSession(
  kind: AutoConnectOptions["storage"] = "local",
  session: PersistedWalletSession | null
): Promise<void> {
  const storage = getWalletSessionStorage(kind)
  if (!storage) return

  try {
    if (session) {
      await storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(session))
    } else {
      await storage.removeItem(WALLET_SESSION_STORAGE_KEY)
    }
  } catch {
    // Quota exceeded, or storage disabled mid-session. Losing the ability to
    // persist is never a reason to break the app.
  }
}

/**
 * Clears the persisted wallet session.
 *
 * @param kind Where to clear: `"local"` for localStorage, `"session"` for sessionStorage, or a custom adapter.
 */
export function clearWalletSession(kind: AutoConnectOptions["storage"] = "local"): Promise<void> {
  return writeWalletSession(kind, null)
}
