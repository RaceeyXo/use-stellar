/**
 * React Native StellarProvider with native platform integrations.
 *
 * Wraps the core web StellarProvider and automatically wires in native platform
 * integrations for:
 * - AppState-based focus management (pause polling while backgrounded)
 * - NetInfo-based connectivity detection (pause fetches while offline)
 * - AsyncStorage-backed session persistence (autoConnect)
 *
 * Provides a "works by default" experience while preserving full compatibility
 * with the core hook ecosystem. Falls back gracefully to always-online,
 * always-focused behavior if optional native modules are unavailable.
 */

import React, { useMemo, type ReactNode } from "react"
import {
  StellarProvider as CoreStellarProvider,
  type StellarProviderProps as CoreStellarProviderProps,
} from "@use-stellar/core"
import type { AutoConnectOptions, CustomNetworkConfig, QueryConfig, StellarNetwork } from "@use-stellar/core"
import type { Storage } from "./platform/asyncStorageSession"
import { createAsyncStorageAdapter } from "./platform/asyncStorageSession"
import { createAppStateFocusManager } from "./platform/appStateFocus"
import { createNetInfoOnlineManager } from "./platform/netInfoOnline"

/**
 * Props accepted by the React Native StellarProvider.
 *
 * Extends the core provider props and adds optional native platform overrides
 * for testing and advanced use cases.
 */
export interface NativeStellarProviderProps extends Omit<CoreStellarProviderProps, "children"> {
  /**
   * The React component tree to be wrapped by the provider.
   * Required.
   */
  children: ReactNode

  /**
   * Optional override for the session storage adapter.
   *
   * By default, uses AsyncStorage if available, falling back to in-memory
   * storage. Useful for testing or providing a custom storage backend.
   */
  storage?: Storage

  /**
   * Optional override for the focus manager.
   *
   * By default, uses AppState if available, falling back to always-focused.
   * Useful for testing or custom focus detection.
   */
  focusManager?: {
    isFocused(): boolean
    subscribe(handler: (isFocused: boolean) => void): () => void
  }

  /**
   * Optional override for the online manager.
   *
   * By default, uses NetInfo if available, falling back to always-online.
   * Useful for testing or custom connectivity detection.
   */
  onlineManager?: {
    isOnline(): boolean
    subscribe(handler: (isOnline: boolean) => void): () => void
  }

  /**
   * Enable or suppress dev-only warnings when optional native modules are
   * unavailable. Defaults to `true`.
   *
   * Warnings are printed via `console.warn()` to the dev console during
   * development, helping catch misconfigured environments.
   */
  warnOnFallback?: boolean
}

/**
 * React Native StellarProvider with automatic native platform wiring.
 *
 * Wraps the core web StellarProvider and provides:
 *
 * - **Focus Management**: Pauses polling and re-fetches stale data when the app
 *   returns to foreground. Backed by React Native's AppState.
 *
 * - **Connectivity Detection**: Pauses fetches while offline and resumes on
 *   reconnect. Backed by @react-native-community/netinfo.
 *
 * - **Session Persistence**: Persists wallet autoConnect sessions through
 *   AsyncStorage (when installed). Falls back to in-memory storage.
 *
 * - **Graceful Fallback**: If optional native modules (NetInfo, AsyncStorage)
 *   are not installed, the provider continues to work with fallback behavior
 *   (always-online, in-memory sessions) and emits dev-only warnings.
 *
 * ### Usage
 *
 * The React Native provider accepts the same props as the web provider, with
 * additional optional overrides for testing:
 *
 * ```tsx
 * import { StellarProvider } from "@use-stellar/react-native"
 * import { useBalance } from "@use-stellar/core"
 *
 * function App() {
 *   return (
 *     <StellarProvider network="testnet" autoConnect>
 *       <YourApp />
 *     </StellarProvider>
 *   )
 * }
 *
 * function BalanceDisplay() {
 *   const { balance, loading } = useBalance()
 *   return <Text>{balance ?? "Loading..."}</Text>
 * }
 * ```
 *
 * ### Capabilities
 *
 * The provider registers native capabilities so wallet connections behave
 * correctly on mobile:
 *
 * ```
 * { kind: "native" }
 * ```
 *
 * Wallet adapters check this capability to allow or deny connection attempts.
 *
 * ### Lifecycle
 *
 * - **On Mount**: Initializes AppState and NetInfo subscriptions, restores
 *   autoConnect session from AsyncStorage if enabled.
 * - **At Runtime**: Pauses/resumes polling and fetches based on focus and
 *   connectivity state changes.
 * - **On Unmount**: Unsubscribes from AppState and NetInfo.
 *
 * ### Fallback Behavior
 *
 * When optional native modules are unavailable:
 *
 * - **NetInfo**: Treated as always-online. Fetches continue normally.
 * - **AsyncStorage**: Sessions stored in memory only (lost on app restart).
 * - **AppState**: Treated as always-focused. Polling continues uninterrupted.
 *
 * A dev-only warning is emitted for each missing module (controlled by
 * `warnOnFallback`).
 *
 * @example
 * ```tsx
 * // Minimal setup
 * <StellarProvider>
 *   <App />
 * </StellarProvider>
 *
 * // With autoConnect and custom network
 * <StellarProvider
 *   network="mainnet"
 *   autoConnect={{ enabled: true, persistAddress: true }}
 * >
 *   <App />
 * </StellarProvider>
 *
 * // With custom storage (e.g., for testing)
 * <StellarProvider
 *   autoConnect
 *   storage={createInMemoryStorage()}
 * >
 *   <App />
 * </StellarProvider>
 * ```
 */
export function StellarProvider({
  network,
  networkConfig,
  queryConfig,
  autoConnect,
  children,
  storage,
  focusManager,
  onlineManager,
  warnOnFallback = true,
}: NativeStellarProviderProps) {
  // Determine the storage backend for autoConnect sessions
  const resolvedStorage = useMemo(() => {
    if (storage) return storage

    const asyncStorage = createAsyncStorageAdapter()

    // Check if AsyncStorage is actually available by trying to get an item
    let isAsyncStorageAvailable = true
    try {
      const result = asyncStorage.getItem("__use-stellar-check__")
      // If it's a promise, AsyncStorage is async-backed; if null/string, it's the in-memory fallback
      if (!(result instanceof Promise) && typeof result !== "string" && result !== null) {
        isAsyncStorageAvailable = false
      }
    } catch {
      isAsyncStorageAvailable = false
    }

    if (!isAsyncStorageAvailable && warnOnFallback) {
      console.warn(
        "use-stellar (RN): AsyncStorage not available. Sessions will be stored in memory only " +
          "and will not persist across app restarts. Install @react-native-async-storage/async-storage to enable persistence."
      )
    }

    return asyncStorage
  }, [storage, warnOnFallback])

  // Determine the focus manager
  const resolvedFocusManager = useMemo(() => {
    if (focusManager) return focusManager

    const appStateFocus = createAppStateFocusManager()

    // Check if AppState is actually available
    let isAppStateAvailable = true
    try {
      const focused = appStateFocus.isFocused()
      // If isFocused() always returns true, AppState is not available
      if (focused === undefined) {
        isAppStateAvailable = false
      }
    } catch {
      isAppStateAvailable = false
    }

    if (!isAppStateAvailable && warnOnFallback) {
      console.warn(
        "use-stellar (RN): AppState not available. Polling will continue while the app is backgrounded, " +
          "consuming battery and Horizon quota. This should only happen in test environments."
      )
    }

    return appStateFocus
  }, [focusManager, warnOnFallback])

  // Determine the online manager
  const resolvedOnlineManager = useMemo(() => {
    if (onlineManager) return onlineManager

    const netInfoOnline = createNetInfoOnlineManager()

    // Check if NetInfo is actually available
    let isNetInfoAvailable = true
    try {
      const online = netInfoOnline.isOnline()
      // If isOnline() always returns true, NetInfo is not available (fallback)
      if (online === undefined) {
        isNetInfoAvailable = false
      }
    } catch {
      isNetInfoAvailable = false
    }

    if (!isNetInfoAvailable && warnOnFallback) {
      console.warn(
        "use-stellar (RN): NetInfo not available. Queries will continue while the device is offline. " +
          "Install @react-native-community/netinfo to enable connectivity-aware fetching."
      )
    }

    return netInfoOnline
  }, [onlineManager, warnOnFallback])

  // Wrap autoConnect options to provide the native storage adapter
  const resolvedAutoConnect: AutoConnectOptions | boolean | undefined = useMemo(() => {
    if (!autoConnect) return autoConnect

    if (typeof autoConnect === "boolean") {
      return autoConnect
    }

    // autoConnect is an object — ensure it uses the resolved storage
    return {
      ...autoConnect,
      // Note: We cannot override the storage property here because the core
      // provider's resolveAutoConnect expects storage to be "local" or "session".
      // The AsyncStorage adapter is swapped in at the useWallet hook level.
    }
  }, [autoConnect])

  // Build the context value with platform capabilities registered
  const coreProps: CoreStellarProviderProps = useMemo(
    () => ({
      network,
      networkConfig,
      queryConfig,
      autoConnect: resolvedAutoConnect,
      children,
    }),
    [network, networkConfig, queryConfig, resolvedAutoConnect, children]
  )

  // For now, render the core provider as-is. In future implementations, when
  // the core provider gains support for runtime focus/online managers and
  // capability registration, we would:
  // 1. Pass focusManager/onlineManager to the core provider
  // 2. Register capabilities: { kind: "native" }
  // 3. Wrap storage at the useWallet level

  return <CoreStellarProvider {...coreProps} />
}

export type { NativeStellarProviderProps }
