import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from "vue"
import { useStellarRuntime } from "@use-stellar/vue"
import {
  getWalletAdapter,
  hasWalletAdapter,
  toStellarError,
  type StellarError,
  type WalletState,
  type WalletType,
} from "use-stellar/core"

/**
 * TODO(vue-46): replace this file with `useWallet` from `@use-stellar/vue`
 * once issue #474 ships it. Until then `@use-stellar/vue` has no wallet
 * composable, and its README tells an app to connect through a core adapter
 * and hand the result to `runtime.setWallet`. This is that wiring, kept in one
 * place and shaped like the composable #474 describes (`address`, `connected`,
 * `connecting`, `walletName`, `error`, `availableWallets`, `connect(id)`,
 * `disconnect()`), so the swap is one import.
 *
 * It does not save the session: the core session writer is not public yet.
 */
export interface UseDemoWalletReturn {
  address: ComputedRef<string | null>
  connected: ComputedRef<boolean>
  connecting: ComputedRef<boolean>
  walletName: ComputedRef<string | null>
  /** The network the wallet itself reports, which may not be the app's. */
  walletNetwork: ComputedRef<string | null>
  /** True when the wallet is on another network than the app. Signing is refused while it is. */
  isNetworkMismatch: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  /** Ids of the registered wallets that are installed and usable in this browser. */
  availableWallets: Ref<WalletType[]>
  refreshAvailableWallets: (ids: readonly WalletType[]) => Promise<void>
  connect: (id: WalletType) => Promise<void>
  disconnect: () => Promise<void>
}

const DISCONNECTED: WalletState = {
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

export function useDemoWallet(): UseDemoWalletReturn {
  const runtime = useStellarRuntime()
  // `runtime.wallet` is a getter over a ref, so reading it here is tracked:
  // every composable that signs sees the same state this one writes.
  const state = computed(() => runtime.wallet)
  const availableWallets = ref<WalletType[]>([])

  // Each connect or disconnect takes a number. A result that comes back after a
  // newer call started is dropped, so two quick clicks cannot leave the state
  // stuck on "connecting" or show the wallet the user moved away from.
  let attempt = 0
  let disposed = false
  const isCurrent = (id: number): boolean => !disposed && id === attempt

  async function refreshAvailableWallets(ids: readonly WalletType[]): Promise<void> {
    const found: WalletType[] = []
    for (const id of ids) {
      if (!hasWalletAdapter(id)) continue
      try {
        if (await getWalletAdapter(id).isAvailable()) found.push(id)
      } catch {
        // A wallet that cannot say whether it is there is treated as absent.
      }
    }
    if (!disposed) availableWallets.value = found
  }

  async function connect(id: WalletType): Promise<void> {
    const current = ++attempt
    runtime.setWallet({ ...DISCONNECTED, connecting: true })
    try {
      const adapter = getWalletAdapter(id)
      const connection = await adapter.connect(runtime.network)
      if (!isCurrent(current)) return
      runtime.setWallet({
        connected: true,
        connecting: false,
        address: connection.address,
        network: runtime.network,
        wallet: connection.wallet,
        walletName: adapter.metadata.name,
        error: null,
        walletNetwork: connection.network,
        // Without the passphrase the write actions cannot tell that the wallet
        // is on another network, and would let it sign for the wrong one.
        walletNetworkPassphrase: connection.networkPassphrase,
      })
    } catch (cause) {
      if (!isCurrent(current)) return
      runtime.setWallet({ ...DISCONNECTED, error: toStellarError(cause) })
    }
  }

  async function disconnect(): Promise<void> {
    const current = ++attempt
    const wallet = runtime.wallet.wallet
    runtime.setWallet({ ...DISCONNECTED })
    if (!wallet || !hasWalletAdapter(wallet)) return
    try {
      await getWalletAdapter(wallet).disconnect?.()
    } catch (cause) {
      if (isCurrent(current)) runtime.setWallet({ ...DISCONNECTED, error: toStellarError(cause) })
    }
  }

  onScopeDispose(() => {
    disposed = true
    attempt += 1
  })

  return {
    address: computed(() => state.value.address),
    connected: computed(() => state.value.connected),
    connecting: computed(() => state.value.connecting),
    walletName: computed(() => state.value.walletName),
    walletNetwork: computed(() => state.value.walletNetwork),
    isNetworkMismatch: computed(
      () =>
        state.value.connected &&
        typeof state.value.walletNetworkPassphrase === "string" &&
        state.value.walletNetworkPassphrase !== runtime.networkConfig.networkPassphrase
    ),
    error: computed(() => state.value.error),
    availableWallets,
    refreshAvailableWallets,
    connect,
    disconnect,
  }
}
