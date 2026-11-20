// packages/vue/src/plugin.ts

import { inject, shallowRef, type App, type InjectionKey, type Ref } from "vue"
import {
  QueryStore,
  getWalletAdapter,
  readWalletSession,
  type QueryConfig,
  type WalletState,
} from "use-stellar/core"
import { NETWORK_CONFIGS, type NetworkConfig, type StellarNetwork } from "./types"

export interface StellarPluginOptions {
  /** Defaults to `"testnet"`. */
  network?: StellarNetwork
  /** Override the built-in Horizon/Soroban endpoints for `network`. Any field left out keeps the default. */
  networkConfig?: Partial<Pick<NetworkConfig, "horizonUrl" | "sorobanUrl" | "networkPassphrase">>
  /** Cache configuration shared by every composable. */
  queryConfig?: QueryConfig
  /** Initial connected wallet address, primarily for restored client sessions. */
  walletAddress?: string | null
  /** Silently restore a saved session in the browser. Disabled by default. */
  autoConnect?: boolean | { enabled: boolean; storage?: "local" | "session" }
}

export interface StellarRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  /** One query cache per app, shared by every composable. */
  queryStore: QueryStore
  /** The wallet connection the write composables sign with. */
  wallet: WalletState
  /** Replaces the wallet state, and keeps `walletAddress` in step with it. */
  setWallet: (wallet: WalletState) => void
  /** The address read composables default to when given none. */
  walletAddress: Ref<string | null>
  setWalletAddress: (address: string | null) => void
}

export const STELLAR_RUNTIME_KEY: InjectionKey<StellarRuntime> = Symbol("use-stellar/vue:runtime")

const DISCONNECTED_WALLET: WalletState = {
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

function resolveNetworkConfig(
  network: StellarNetwork,
  override: StellarPluginOptions["networkConfig"]
): NetworkConfig {
  const builtIn = NETWORK_CONFIGS[network]
  if (!override) return builtIn

  return {
    network,
    horizonUrl: override.horizonUrl ?? builtIn.horizonUrl,
    sorobanUrl: override.sorobanUrl ?? builtIn.sorobanUrl,
    networkPassphrase: override.networkPassphrase ?? builtIn.networkPassphrase,
  }
}

/**
 * Builds a Stellar runtime without installing it as a plugin. Used by
 * {@link createStellarPlugin} itself, and by the test harness in
 * `use-stellar/vue/test-utils` to provide a runtime without a real app.
 */
export function createStellarRuntime(options: StellarPluginOptions = {}): StellarRuntime {
  const network = options.network ?? "testnet"
  const walletAddress = shallowRef(options.walletAddress ?? null)
  const wallet = shallowRef<WalletState>({
    ...DISCONNECTED_WALLET,
    address: options.walletAddress ?? null,
  })

  const runtime: StellarRuntime = {
    network,
    networkConfig: resolveNetworkConfig(network, options.networkConfig),
    queryStore: new QueryStore(options.queryConfig),
    get wallet() {
      return wallet.value
    },
    set wallet(value: WalletState) {
      wallet.value = value
    },
    setWallet(wallet): void {
      runtime.wallet = wallet
      walletAddress.value = wallet.address
    },
    walletAddress,
    setWalletAddress(address: string | null): void {
      walletAddress.value = address
    },
  }
  return runtime
}

const restorations = new WeakMap<StellarRuntime, Promise<void>>()

/** Restore only in a browser, and only when the adapter permits silent reconnect. */
export function restoreWalletSession(
  runtime: StellarRuntime,
  storage: "local" | "session" = "local"
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  const existing = restorations.get(runtime)
  if (existing) return existing
  if (runtime.wallet.connected || runtime.wallet.connecting) return Promise.resolve()

  const originalAddress = runtime.walletAddress.value
  const pendingWallet = { ...runtime.wallet, connecting: true }
  runtime.setWallet(pendingWallet)
  const isCurrent = () =>
    runtime.wallet === pendingWallet &&
    !runtime.wallet.connected &&
    runtime.walletAddress.value === originalAddress

  const restoration = (async () => {
    try {
      const session = await readWalletSession(storage)
      if (!session || !isCurrent()) return
      const adapter = getWalletAdapter(session.wallet)
      if (!(await adapter.isAvailable()) || !isCurrent()) return
      const sameChain = !session.chain || session.chain === "stellar:" + runtime.network
      const canReconnect =
        sameChain && adapter.canAutoConnect ? await adapter.canAutoConnect(runtime.network) : false
      if (!isCurrent()) return
      if (!canReconnect) {
        runtime.setWallet({
          ...pendingWallet,
          connecting: false,
          wallet: session.wallet,
          walletName: adapter.metadata.name,
          address: session.address ?? null,
        })
        return
      }
      const connection = await adapter.connect(runtime.network)
      if (!isCurrent()) return
      const network = await adapter.getNetworkDetails(runtime.network)
      if (!isCurrent()) return
      runtime.setWallet({
        connected: true,
        connecting: false,
        address: connection.address,
        network: runtime.network,
        wallet: connection.wallet,
        walletName: adapter.metadata.name,
        error: null,
        walletNetwork: network.network,
        walletNetworkPassphrase: network.networkPassphrase,
      })
    } catch {
      // Missing storage, unavailable extensions and expired permissions leave
      // the app usable. AutoConnect must never fall back to prompting.
    } finally {
      if (runtime.wallet === pendingWallet) {
        runtime.setWallet({ ...runtime.wallet, connecting: false })
      }
    }
  })().finally(() => {
    if (restorations.get(runtime) === restoration) restorations.delete(runtime)
  })
  restorations.set(runtime, restoration)
  return restoration
}

interface RuntimeApp {
  provide: (key: InjectionKey<StellarRuntime>, value: StellarRuntime) => unknown
}

/** Shared installation path for plain Vue and the Nuxt runtime adapter. */
export function installStellarRuntime(
  app: RuntimeApp,
  options: StellarPluginOptions = {},
  isClient = typeof window !== "undefined"
): Promise<void> {
  const { autoConnect, ...runtimeOptions } = options
  const runtime = createStellarRuntime(runtimeOptions)
  app.provide(STELLAR_RUNTIME_KEY, runtime)
  const enabled = typeof autoConnect === "boolean" ? autoConnect : (autoConnect?.enabled ?? false)
  const storage = typeof autoConnect === "object" ? (autoConnect.storage ?? "local") : "local"
  return isClient && enabled && typeof window !== "undefined"
    ? restoreWalletSession(runtime, storage)
    : Promise.resolve()
}

/**
 * Vue plugin that installs the Stellar runtime — resolved network config plus
 * one shared query cache — so every composable in this package reads and
 * writes through the same instance.
 *
 * @example
 * import { createApp } from "vue"
 * import { createStellarPlugin } from "@use-stellar/vue"
 *
 * createApp(App).use(createStellarPlugin({ network: "testnet" })).mount("#app")
 */
export function createStellarPlugin(options: StellarPluginOptions = {}) {
  return {
    install(app: App): void {
      void installStellarRuntime(app, options)
    },
  }
}

/**
 * Reads the installed Stellar runtime.
 *
 * @throws {Error} when called outside a component tree the plugin was
 * installed on (or outside `app.runWithContext()` in tests).
 */
export function useStellarRuntime(): StellarRuntime {
  const runtime = inject(STELLAR_RUNTIME_KEY)
  if (!runtime) {
    throw new Error(
      "@use-stellar/vue: no plugin installed. Call " +
        "app.use(createStellarPlugin()) before using any composable."
    )
  }
  return runtime
}
