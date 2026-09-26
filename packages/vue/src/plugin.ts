// packages/vue/src/plugin.ts

import { inject, type App, type InjectionKey } from "vue"
import { VueQueryStore, type QueryStoreConfig } from "./store"
import { NETWORK_CONFIGS, type NetworkConfig, type StellarNetwork } from "./types"

export interface StellarPluginOptions {
  /** Defaults to `"testnet"`. */
  network?: StellarNetwork
  /** Override the built-in Horizon/Soroban endpoints for `network`. Any field left out keeps the default. */
  networkConfig?: Partial<Pick<NetworkConfig, "horizonUrl" | "sorobanUrl" | "networkPassphrase">>
  /** Cache configuration shared by every composable. */
  queryConfig?: QueryStoreConfig
}

export interface StellarRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  queryStore: VueQueryStore
}

export const STELLAR_RUNTIME_KEY: InjectionKey<StellarRuntime> = Symbol("use-stellar/vue:runtime")

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
  return {
    network,
    networkConfig: resolveNetworkConfig(network, options.networkConfig),
    queryStore: new VueQueryStore(options.queryConfig),
  }
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
      app.provide(STELLAR_RUNTIME_KEY, createStellarRuntime(options))
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
