/**
 * Framework-neutral Stellar runtime that owns resolved network configuration,
 * wallet state, and the query store outside of any React or Vue components.
 *
 * Both React and Vue adapters use this runtime and adapt it to their own
 * reactivity models via subscriptions and snapshots.
 */

import type { NetworkConfig, StellarNetwork, WalletState } from "../types"
// From the module itself, not the "../cache" index: that index also re-exports
// the React `useQuery`, which would pull `react` into the React-free
// `use-stellar/core` entry.
import { QueryStore } from "../cache/store"
import type { QueryConfig } from "../cache/types"

/**
 * Options for creating a StellarRuntime instance.
 */
export interface StellarRuntimeOptions {
  /** The resolved network configuration. */
  networkConfig: NetworkConfig
  /** Cache configuration: `staleTime` and `gcTime`, both in milliseconds. */
  queryConfig?: QueryConfig
}

/**
 * A snapshot of the runtime state at a point in time.
 * Immutable and safe to store, compare, or pass around.
 */
export interface StellarRuntimeSnapshot {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
}

/**
 * A listener called whenever the runtime state changes.
 * Receives the new snapshot and is responsible for extracting what it needs.
 */
export type StellarRuntimeListener = (snapshot: StellarRuntimeSnapshot) => void

/**
 * Framework-neutral Stellar runtime.
 *
 * Owns the network configuration, wallet state, and query store. Provides
 * immutable snapshots and a subscription API so frameworks can adapt it to
 * their own reactivity models without reimplementing wallet/network logic.
 *
 * The runtime is independent of React, Vue, or any other framework — it is
 * pure state management with synchronous notifications.
 */
export class StellarRuntime {
  private networkConfig: NetworkConfig
  private wallet: WalletState
  private queryStore: QueryStore
  private listeners = new Set<StellarRuntimeListener>()

  constructor(options: StellarRuntimeOptions) {
    this.networkConfig = options.networkConfig
    this.queryStore = new QueryStore(options.queryConfig)
    this.wallet = {
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
  }

  /**
   * Returns an immutable snapshot of the current runtime state.
   * Safe to store and compare across renders or reactivity boundaries.
   */
  getSnapshot(): StellarRuntimeSnapshot {
    return {
      network: this.networkConfig.network,
      networkConfig: this.networkConfig,
      wallet: this.wallet,
    }
  }

  /**
   * Subscribes to runtime state changes.
   *
   * The listener is called synchronously whenever `updateWallet()` or
   * `updateNetwork()` is called. It receives the new snapshot.
   *
   * Returns an unsubscribe function to stop receiving notifications.
   */
  subscribe(listener: StellarRuntimeListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Updates the wallet state and notifies subscribers.
   *
   * Consumers must pass a new wallet object; mutations are not tracked.
   * This is the only way to change the wallet from outside the runtime.
   */
  updateWallet(wallet: WalletState): void {
    this.wallet = wallet
    this.notifyListeners()
  }

  /**
   * Updates the network configuration and notifies subscribers.
   *
   * Typically called when the app's network selection changes, not during
   * normal operation.
   */
  updateNetwork(networkConfig: NetworkConfig): void {
    this.networkConfig = networkConfig
    this.notifyListeners()
  }

  /**
   * Returns the query store, which all fetching hooks read and write through.
   * Typically accessed once at initialization and reused.
   */
  getQueryStore(): QueryStore {
    return this.queryStore
  }

  /**
   * Internal: notify all listeners of a state change.
   */
  private notifyListeners(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}

/**
 * Factory to create a new StellarRuntime instance.
 *
 * @example
 * const runtime = createStellarRuntime({
 *   networkConfig: { ... },
 *   queryConfig: { staleTime: 30000 }
 * })
 */
export function createStellarRuntime(options: StellarRuntimeOptions): StellarRuntime {
  return new StellarRuntime(options)
}
