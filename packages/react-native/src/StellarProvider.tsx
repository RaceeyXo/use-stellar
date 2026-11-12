/**
 * React Native StellarProvider with native platform integrations.
 *
 * Wraps the core StellarProvider and automatically wires in native platform
 * integrations for:
 * - AppState-based focus management (pause polling while backgrounded)
 * - NetInfo-based connectivity detection (pause fetches while offline)
 * - AsyncStorage-backed session persistence (autoConnect)
 *
 * Provides a "works by default" experience while preserving full compatibility
 * with the core hook ecosystem. Falls back gracefully to always-online,
 * in-memory behavior if optional native modules are unavailable.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import {
  NATIVE_PLATFORM,
  StellarProvider as CoreStellarProvider,
  focusManager as coreFocusManager,
  onlineManager as coreOnlineManager,
  registerWalletAdapter,
  type StellarProviderProps as CoreStellarProviderProps,
} from "use-stellar"
import type { AutoConnectOptions } from "use-stellar"
import type { Storage } from "./platform/asyncStorageSession"
import { createAsyncStorageAdapter, loadAsyncStorage } from "./platform/asyncStorageSession"
import { createAppStateFocusManager, loadAppState } from "./platform/appStateFocus"
import { createNetInfoOnlineManager, loadNetInfo } from "./platform/netInfoOnline"
import {
  createReactNativeWalletConnectAdapter,
  type ReactNativeWalletConnectOptions,
} from "./wallets/walletConnect"

/**
 * How long (seconds) a transaction stays valid on native by default.
 *
 * Longer than the web default of 30: signing on a phone means switching to a
 * wallet app, approving there, and coming back, and the clock has been running
 * since before the hand-off. Override with the `transactionTimeout` prop.
 */
export const NATIVE_TRANSACTION_TIMEOUT = 300

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

  /**
   * Enables WalletConnect v2 for compatible Stellar mobile wallets. No
   * WalletConnect modules are loaded unless this option and projectId exist.
   */
  walletConnect?: ReactNativeWalletConnectOptions
}

/**
 * React Native StellarProvider with automatic native platform wiring.
 *
 * Wraps the core StellarProvider and provides:
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
 * import { StellarProvider, useBalance } from "@use-stellar/react-native"
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
 * ### Platform
 *
 * React Native defines a global `window`, so core's own detection would take a
 * native app for a browser. This provider declares the platform as native
 * (`NATIVE_PLATFORM`) instead. Pass `platform` to override.
 *
 * ### Lifecycle
 *
 * - **On Mount**: Subscribes to AppState and NetInfo, and restores the
 *   autoConnect session from storage if enabled.
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
  transactionTimeout = NATIVE_TRANSACTION_TIMEOUT,
  platform = NATIVE_PLATFORM,
  children,
  storage,
  focusManager,
  onlineManager,
  warnOnFallback = true,
  walletConnect,
}: NativeStellarProviderProps) {
  // Creating a manager or adapter attaches nothing: the native listeners are
  // added with the first subscriber (the effects below) and removed with the
  // last, so a remount or a StrictMode double-invoke leaves none behind.
  const resolvedStorage = useMemo(() => storage ?? createAsyncStorageAdapter(), [storage])
  const resolvedFocusManager = useMemo(
    () => focusManager ?? createAppStateFocusManager(),
    [focusManager]
  )
  const resolvedOnlineManager = useMemo(
    () => onlineManager ?? createNetInfoOnlineManager(),
    [onlineManager]
  )

  // Say which fallback is in effect, once per mount. Each check asks the same
  // loader the factory used, so a warning means the fallback really is active.
  useEffect(() => {
    if (!warnOnFallback) return

    if (!storage && !loadAsyncStorage()) {
      console.warn(
        "use-stellar (RN): AsyncStorage not available. Sessions will be stored in memory only " +
          "and will not persist across app restarts. Install @react-native-async-storage/async-storage to enable persistence."
      )
    }
    if (!focusManager && !loadAppState()) {
      console.warn(
        "use-stellar (RN): AppState not available. Polling will continue while the app is backgrounded, " +
          "consuming battery and Horizon quota. This should only happen in test environments."
      )
    }
    if (!onlineManager && !loadNetInfo()) {
      console.warn(
        "use-stellar (RN): NetInfo not available. Queries will continue while the device is offline. " +
          "Install @react-native-community/netinfo to enable connectivity-aware fetching."
      )
    }
  }, [warnOnFallback, storage, focusManager, onlineManager])

  // Route session persistence through native storage. Core's own defaults
  // ("local" / "session") name browser storage, which does not exist here — so
  // unless the app handed over an adapter of its own, use the resolved one.
  const autoConnectOptions = typeof autoConnect === "boolean" ? undefined : autoConnect
  const autoConnectEnabled =
    typeof autoConnect === "boolean" ? autoConnect : autoConnectOptions?.enabled
  const autoConnectPersistAddress = autoConnectOptions?.persistAddress
  const autoConnectStorage =
    typeof autoConnectOptions?.storage === "object" ? autoConnectOptions.storage : undefined

  const resolvedAutoConnect: AutoConnectOptions = useMemo(
    () => ({
      enabled: autoConnectEnabled,
      persistAddress: autoConnectPersistAddress,
      storage: autoConnectStorage ?? resolvedStorage,
    }),
    [autoConnectEnabled, autoConnectPersistAddress, autoConnectStorage, resolvedStorage]
  )

  // Register WalletConnect only when explicitly configured. The core adapter
  // loads its SignClient lazily on connect, so merely mounting this provider
  // makes no WalletConnect network requests.
  //
  // Keyed on the project ID rather than the options object, which apps pass
  // inline; the adapter reads the latest callbacks through the ref.
  const walletConnectRef = useRef(walletConnect)
  walletConnectRef.current = walletConnect
  const walletConnectProjectId = walletConnect?.projectId?.trim()

  // A layout effect, so the adapter is registered before any child's effect
  // runs — `useWallet` restores a session in an effect, and a session for a
  // wallet that is not registered yet is discarded as unknown.
  useLayoutEffect(() => {
    const options = walletConnectRef.current
    if (!walletConnectProjectId || !options) return

    registerWalletAdapter(
      createReactNativeWalletConnectAdapter({
        projectId: walletConnectProjectId,
        metadata: options.metadata,
        storage: options.storage,
        onPairingUri: uri => walletConnectRef.current?.onPairingUri?.(uri),
        openWallet: options.openWallet
          ? uri => walletConnectRef.current?.openWallet?.(uri)
          : undefined,
      }),
      { override: true }
    )
  }, [walletConnectProjectId])

  // Drive core's shared focus manager from AppState, so polling hooks pause
  // while the app is backgrounded. The AppState manager reports its current
  // state on subscribe, so core starts from the real state. Unmounting hands
  // focus back to page visibility (or "always focused" with no document).
  useEffect(() => {
    coreFocusManager.setPlatform("native")
    const unsubscribe = resolvedFocusManager.subscribe(focused =>
      coreFocusManager.setFocused(focused)
    )
    return () => {
      unsubscribe()
      coreFocusManager.setPlatform(typeof document === "undefined" ? "server" : "web")
    }
  }, [resolvedFocusManager])

  // Drive core's shared online manager from NetInfo, so queries pause offline
  // and refetch once on reconnect. Unmounting restores the web default.
  useEffect(() => {
    coreOnlineManager.setEventListener(setOnline => resolvedOnlineManager.subscribe(setOnline))
    return () => coreOnlineManager.setEventListener()
  }, [resolvedOnlineManager])

  return (
    <CoreStellarProvider
      network={network}
      networkConfig={networkConfig}
      queryConfig={queryConfig}
      autoConnect={resolvedAutoConnect}
      transactionTimeout={transactionTimeout}
      platform={platform}
    >
      {children}
    </CoreStellarProvider>
  )
}
