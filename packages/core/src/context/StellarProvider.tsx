import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type {
  AutoConnectOptions,
  CustomNetworkConfig,
  NetworkConfig,
  StellarContextValue,
  StellarNetwork,
  WalletState,
} from "../types"
import { NETWORK_CONFIGS } from "../types"
import { QueryStore } from "../cache"
import type { QueryConfig } from "../cache"

export type { AutoConnectOptions, QueryConfig }

/**
 * The default initial state for a wallet connection in the Stellar context.
 *
 * - `connected`: false (no wallet has established a connection yet)
 * - `connecting`: false (no active connection request is in progress)
 * - `address`: null (no public key address is available)
 * - `network`: null (no context network associated with the wallet yet)
 * - `wallet`: null (no wallet provider selected)
 * - `walletName`: null (no friendly name for the wallet provider)
 * - `error`: null (no connection-related errors have occurred)
 * - `walletNetwork`: null (no network detected from the wallet browser extension itself)
 */
const DEFAULT_WALLET: WalletState = {
  connected: false,
  connecting: false,
  address: null,
  network: null,
  wallet: null,
  walletName: null,
  error: null,
  walletNetwork: null,
  walletNetworkPassphrase: null,
}

/** Storage key holding the persisted wallet session. */
export const WALLET_SESSION_STORAGE_KEY = "use-stellar:wallet-session"

/**
 * React Context object that holds the Stellar context value or null.
 * Primarily consumed via the `useStellarContext` helper.
 */
const StellarContext = createContext<StellarContextValue | null>(null)

// ── Validation ─────────────────────────────────────────────────────────────
/** Returns the built-in config for a network, or `undefined` for `"custom"`. */
function getBuiltInConfig(network: StellarNetwork): NetworkConfig | undefined {
  return network === "custom" ? undefined : NETWORK_CONFIGS[network]
}

/**
 * Validates a custom network config override and returns the merged
 * `NetworkConfig`, including the resolved `networkPassphrase`. Throws a
 * descriptive error if anything required is missing or obviously malformed, so
 * developers catch misconfiguration at startup.
 *
 * This is the single place a passphrase is resolved. Every hook that builds a
 * transaction reads `networkConfig.networkPassphrase` rather than deciding for
 * itself, because a passphrase chosen per-call-site is a passphrase that can
 * disagree with itself — and a signature bound to the wrong network is
 * rejected in a way nothing in the library would suspect.
 */
function resolveNetworkConfig(
  network: StellarNetwork,
  override: CustomNetworkConfig | undefined
): NetworkConfig {
  const builtIn = getBuiltInConfig(network)

  if (!override) {
    if (!builtIn) {
      throw new Error(
        'use-stellar: network="custom" requires a networkConfig with ' +
          "`horizonUrl`, `sorobanUrl`, and `networkPassphrase`. " +
          'Example: { horizonUrl: "http://localhost:8000", ' +
          'sorobanUrl: "http://localhost:8000/soroban/rpc", ' +
          'networkPassphrase: "Standalone Network ; February 2017" }'
      )
    }

    // No override — use the built-in SDF defaults.
    return builtIn
  }

  const { horizonUrl, sorobanUrl, networkPassphrase } = override

  if (!horizonUrl || typeof horizonUrl !== "string" || horizonUrl.trim() === "") {
    throw new Error(
      "use-stellar: Invalid networkConfig — `horizonUrl` is required when " +
        "providing a custom networkConfig. " +
        'Example: { horizonUrl: "https://horizon.my-node.com", sorobanUrl: "..." }'
    )
  }

  if (!sorobanUrl || typeof sorobanUrl !== "string" || sorobanUrl.trim() === "") {
    throw new Error(
      "use-stellar: Invalid networkConfig — `sorobanUrl` is required when " +
        "providing a custom networkConfig. " +
        'Example: { horizonUrl: "...", sorobanUrl: "https://rpc.my-node.com" }'
    )
  }

  const hasPassphrase = typeof networkPassphrase === "string" && networkPassphrase.trim() !== ""

  // Never default a passphrase for a network we ship no defaults for. Signing
  // with a silently-chosen passphrase must not be reachable.
  if (!hasPassphrase && !builtIn) {
    throw new Error(
      'use-stellar: Invalid networkConfig — `networkPassphrase` is required when network="custom". ' +
        "There is no default passphrase for a network this library ships no configuration for, and " +
        "guessing one would sign transactions that the target network rejects. " +
        'Example: { networkPassphrase: "Standalone Network ; February 2017" }'
    )
  }

  return {
    network,
    horizonUrl: horizonUrl.trim(),
    sorobanUrl: sorobanUrl.trim(),
    networkPassphrase: hasPassphrase
      ? (networkPassphrase as string).trim()
      : (builtIn as NetworkConfig).networkPassphrase,
  }
}

// ── Provider ───────────────────────────────────────────────────────────────
/**
 * Props accepted by the `StellarProvider` component.
 */
export interface StellarProviderProps {
  /**
   * The Stellar network environment.
   *
   * - **Optional**: If omitted or invalid, it defaults to `"testnet"`.
   * - **Values**: `"testnet"`, `"mainnet"`, and `"futurenet"` are pre-configured with SDF
   *             Horizon/Soroban RPC endpoints and the matching network passphrase.
   *             `"custom"` ships no defaults — supply `networkConfig` with all three fields.
   * - **Impact**: Configures Horizon and Soroban RPC URL endpoints via `NETWORK_CONFIGS`, and
   *             resolves the network passphrase every transaction is signed against, for all
   *             downstream hooks.
   */
  network?: StellarNetwork
  /**
   * Optional override for Horizon and Soroban RPC endpoints, and for the
   * network passphrase. When omitted, the built-in SDF endpoints are used.
   *
   * Both `horizonUrl` and `sorobanUrl` are required when this prop is provided.
   * `networkPassphrase` is optional for a known network and required when
   * `network="custom"` — a custom network with no passphrase throws at render.
   *
   * @example
   * // Custom private node on a known network:
   * <StellarProvider
   *   network="mainnet"
   *   networkConfig={{
   *     horizonUrl: "https://horizon.my-node.com",
   *     sorobanUrl: "https://rpc.my-node.com",
   *   }}
   * />
   *
   * @example
   * // A local standalone container:
   * <StellarProvider
   *   network="custom"
   *   networkConfig={{
   *     horizonUrl: "http://localhost:8000",
   *     sorobanUrl: "http://localhost:8000/soroban/rpc",
   *     networkPassphrase: "Standalone Network ; February 2017",
   *   }}
   * />
   */
  networkConfig?: CustomNetworkConfig
  /**
   * Cache configuration: `staleTime` and `gcTime`, both in milliseconds.
   *
   * - **staleTime** (default 30 000): How long fetched data is considered
   *   fresh. Within this window a re-mount serves from cache with no network
   *   request.
   * - **gcTime** (default 300 000): How long a cache entry is kept after all
   *   hook instances that use it have unmounted. Set to 0 to evict immediately.
   *
   * Both can be overridden per hook call.
   *
   * @example
   * <StellarProvider queryConfig={{ staleTime: 60_000, gcTime: 600_000 }}>
   */
  queryConfig?: QueryConfig
  /**
   * Restores the previous wallet session on mount.
   *
   * **Off by default.** When enabled, `useWallet` reconnects only if the
   * wallet can do so without a fresh approval prompt. If a prompt would be
   * required it restores intent instead — the wallet is pre-selected, but the
   * user still clicks Connect. An autoconnect that pops an approval dialog on
   * every page load is worse than no autoconnect.
   *
   * @example
   * <StellarProvider autoConnect>
   * <StellarProvider autoConnect={{ enabled: true, persistAddress: true }}>
   */
  autoConnect?: boolean | AutoConnectOptions
  /**
   * The React component tree to be wrapped by the provider.
   *
   * - **Required**: Must contain React components that will consume the Stellar context.
   * - **Omission**: If omitted, it will cause build-time TypeScript errors or render an empty provider.
   */
  children: ReactNode
}

/** Normalises the `autoConnect` prop into a fully-resolved options object. */
function resolveAutoConnect(
  autoConnect: boolean | AutoConnectOptions | undefined
): Required<AutoConnectOptions> {
  const options = typeof autoConnect === "boolean" ? { enabled: autoConnect } : (autoConnect ?? {})

  return {
    enabled: options.enabled ?? false,
    persistAddress: options.persistAddress ?? false,
    storage: options.storage ?? "local",
  }
}

/**
 * StellarProvider wraps your React application to manage the active Stellar network configuration
 * and wallet connection states. It serves as the single source of truth for the SDK/wallet contexts.
 *
 * ### Lifecycle and Resource Management:
 * - **On Mount**: Initializes the internal `wallet` state with `DEFAULT_WALLET`. It does not make
 *   any network requests, open WebSocket connections, setup timers, or add window event listeners
 *   upon initial mounting. This makes the provider lightweight, fast to mount, and fully server-side
 *   rendering (SSR) safe.
 * - **At Runtime**:
 *   - The `network` prop can change dynamically if updated by the parent component. When the
 *     `network` prop changes, the context updates its network config instantly, notifying all downstream hooks.
 *   - The `wallet` state is dynamically managed via the returned `setWallet` function when a wallet
 *     adapter (e.g. Freighter, LOBSTR) connects, disconnects, or updates network profiles.
 * - **On Unmount**: Because no background resources (like network polling, socket connections, or event listeners)
 *   are spawned during initialization or maintained directly by this provider, no cleanup or
 *   unsubscription operations are performed during the unmount phase.
 *
 * @example
 * ```tsx
 * <App>
 *   <StellarProvider>
 *     <YourApplication />
 *   </StellarProvider>
 * </App>
 * ```
 */
export function StellarProvider({
  network = "testnet",
  networkConfig: networkConfigOverride,
  queryConfig,
  autoConnect,
  children,
}: StellarProviderProps) {
  // Resolve once at render time — throws immediately on bad config so
  // developers see the error in the console/overlay rather than silently
  // getting undefined URLs at request time.
  const resolvedNetworkConfig = useMemo(
    () => resolveNetworkConfig(network, networkConfigOverride),
    // Depend on the fields resolveNetworkConfig actually reads, not on the
    // object: callers routinely pass an inline `networkConfig={{...}}`, and
    // depending on its identity would re-resolve — and re-render every
    // consumer — on every render. `networkPassphrase` belongs here too; it is
    // read alongside the two URLs, so omitting it left a custom passphrase
    // change stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      network,
      networkConfigOverride?.horizonUrl,
      networkConfigOverride?.sorobanUrl,
      networkConfigOverride?.networkPassphrase,
    ]
  )

  const [wallet, setWallet] = useState<WalletState>(DEFAULT_WALLET)

  // The QueryStore is created once per provider mount (not per render).
  // We use useRef so the store instance is stable — recreating it on every
  // render would lose all cached data, defeating the purpose entirely.
  //
  // When queryConfig changes we do NOT recreate the store: staleTime and
  // gcTime are read from the store's config at access time, so a prop update
  // takes effect on the next fetch/eviction without invalidating the cache.
  const queryConfigRef = useRef(queryConfig)
  queryConfigRef.current = queryConfig

  const queryStore = useMemo(() => new QueryStore(queryConfig), []) // eslint-disable-line

  const value: StellarContextValue = {
    network,
    networkConfig: resolvedNetworkConfig,
    wallet,
    setWallet,
    autoConnect: resolveAutoConnect(autoConnect),
    queryStore,
  }

  return <StellarContext.Provider value={value}>{children}</StellarContext.Provider>
}

/**
 * Custom hook to consume the Stellar provider context values.
 *
 * @throws {Error} If called outside of a `<StellarProvider>` context hierarchy.
 * @returns {StellarContextValue} The active network, network config, wallet state, and state setter.
 */
export function useStellarContext(): StellarContextValue {
  const ctx = useContext(StellarContext)
  if (!ctx) {
    throw new Error(
      "use-stellar: No StellarProvider found. " +
        "Wrap your app in <StellarProvider> before using any use-stellar hooks."
    )
  }
  return ctx
}
