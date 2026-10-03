/**
 * @use-stellar/react-native
 *
 * React Native StellarProvider with native platform integrations for AppState,
 * NetInfo, and AsyncStorage, plus every public API from `use-stellar`, so apps
 * depend on one package.
 *
 * NOTE: Does NOT import polyfills. Apps must explicitly import:
 *   import "@use-stellar/react-native/polyfills"
 */

// ── Provider ───────────────────────────────────────────────────────────────
// The native provider. This explicit export takes precedence over the web
// `StellarProvider` that `export * from "use-stellar"` below would re-export.
export { StellarProvider } from "./StellarProvider"
export type { NativeStellarProviderProps } from "./StellarProvider"

// ── Platform integrations ──────────────────────────────────────────────────
export { createAppStateFocusManager, createAlwaysFocusedManager } from "./platform/appStateFocus"
export type { FocusManager } from "./platform/appStateFocus"

export { createNetInfoOnlineManager, createAlwaysOnlineManager } from "./platform/netInfoOnline"
export type { OnlineManager } from "./platform/netInfoOnline"

export { createAsyncStorageAdapter, createInMemoryStorage } from "./platform/asyncStorageSession"
export type { Storage } from "./platform/asyncStorageSession"

export {
  initDeepLinkHandler,
  registerPendingRequest,
  persistSession,
  restoreSession,
  clearSession,
} from "./platform/deepLinkHandler"
export type { WalletSession } from "./platform/deepLinkHandler"

// ── Everything else from core ──────────────────────────────────────────────
// Hooks, wallet adapters, errors, utilities, and types — the same hooks the
// web build uses, never a fork.
export * from "use-stellar"
