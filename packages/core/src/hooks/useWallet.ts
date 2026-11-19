import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import type { StellarNetwork, WalletState, WalletType } from "../types"
import { createStellarError, toStellarError } from "../errors"
import { getWalletAdapter } from "../wallets"
import { readWalletSession, writeWalletSession } from "../runtime/walletSession"
import type { WalletAdapter, WalletChange } from "../wallets"

export interface UseWalletReturn extends WalletState {
  connect: (wallet?: WalletType) => Promise<void>
  disconnect: () => void
  refreshWalletNetwork: () => Promise<void>
  isNetworkMismatch: boolean
  /**
   * The wallet a previous session used, restored from storage but not
   * connected — because reconnecting it would have raised an approval prompt.
   * Pre-select it in your connect UI and let the user click.
   */
  restoredWallet: WalletType | null
}

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

async function resolveWalletNetwork(
  adapter: WalletAdapter,
  network: StellarNetwork
): Promise<Pick<WalletState, "walletNetwork" | "walletNetworkPassphrase">> {
  const state = await adapter.getNetworkDetails(network)
  return {
    walletNetwork: state.network,
    walletNetworkPassphrase: state.networkPassphrase,
  }
}

/**
 * Manages wallet connection state and provides functions to connect and disconnect.
 *
 * When the provider is given `autoConnect`, the previous session is restored on
 * mount — reconnected outright if the wallet allows it silently, otherwise
 * surfaced as `restoredWallet` so your UI can pre-select it without prompting.
 *
 * While connected, changes the user makes inside their wallet extension
 * (switching account or network) arrive through the adapter's subscription and
 * update `address` and `walletNetwork` with no user action.
 *
 * @returns `{ connected, connecting, address, network, wallet, walletName, error, connect, disconnect }`
 *
 * @example
 * const { address, connect, disconnect } = useWallet()
 * await connect("freighter")
 */
export function useWallet(): UseWalletReturn {
  const { wallet, setWallet, network, autoConnect, platform } = useStellarContext()

  // Tracks whether this hook is still mounted, so a late wallet response or a
  // watcher tick can never call setWallet on an unmounted component.
  const mountedRef = useRef(true)
  const [restoredWallet, setRestoredWallet] = useState<WalletType | null>(null)

  const safeSetWallet = useCallback(
    (update: React.SetStateAction<WalletState>) => {
      if (!mountedRef.current) return
      setWallet(update)
    },
    [setWallet]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const connect = useCallback(
    async (walletType: WalletType = "freighter") => {
      if (!platform.canConnectWallet) {
        if (platform.isServer) {
          safeSetWallet(prev => ({
            ...prev,
            error: createStellarError(
              "VALIDATION_ERROR",
              "Wallet connection is only available in the browser. " +
                'Move your component to a "use client" boundary in Next.js / Remix.'
            ),
          }))
        } else {
          safeSetWallet(prev => ({
            ...prev,
            error: createStellarError(
              "VALIDATION_ERROR",
              `Wallet connection is not available on platform: ${platform.kind}`
            ),
          }))
        }
        return
      }

      safeSetWallet(prev => ({ ...prev, connecting: true, error: null }))

      try {
        const adapter = getWalletAdapter(walletType)
        const connection = await adapter.connect(network)

        // The wallet's own network, not the one we asked for — otherwise the
        // mismatch check compares a value with itself and never fires.
        const walletNetwork = await resolveWalletNetwork(adapter, network)

        safeSetWallet({
          connected: true,
          connecting: false,
          address: connection.address,
          network,
          wallet: connection.wallet,
          walletName: adapter.metadata.name,
          error: null,
          ...walletNetwork,
        })

        setRestoredWallet(null)

        if (autoConnect.enabled) {
          void writeWalletSession(autoConnect.storage, {
            wallet: String(connection.wallet),
            ...(autoConnect.persistAddress ? { address: connection.address } : {}),
          })
        }
      } catch (err) {
        safeSetWallet(prev => ({
          ...prev,
          connecting: false,
          error: toStellarError(err),
        }))
      }
    },
    [
      safeSetWallet,
      network,
      autoConnect.enabled,
      autoConnect.persistAddress,
      autoConnect.storage,
      platform,
    ]
  )

  const disconnect = useCallback(() => {
    if (wallet.wallet) {
      try {
        void getWalletAdapter(wallet.wallet).disconnect?.()
      } catch {
        // A wallet we can no longer resolve is already disconnected as far as
        // the app is concerned — clearing state below is the whole job.
      }
    }

    setRestoredWallet(null)
    void writeWalletSession(autoConnect.storage, null)

    safeSetWallet(DISCONNECTED_WALLET)
  }, [safeSetWallet, wallet.wallet, autoConnect.storage])

  const refreshWalletNetwork = useCallback(async () => {
    if (!wallet.connected || !wallet.wallet) {
      return
    }

    try {
      const adapter = getWalletAdapter(wallet.wallet)
      if (!wallet.network) return
      const resolved = await resolveWalletNetwork(adapter, wallet.network)

      safeSetWallet(prev => ({
        ...prev,
        ...resolved,
        error: null,
      }))
    } catch (err) {
      safeSetWallet(prev => ({
        ...prev,
        error: toStellarError(err),
      }))
    }
  }, [wallet.connected, wallet.wallet, wallet.network, safeSetWallet])

  // ── Session restore ──────────────────────────────────────────────────────
  // Runs once per mount. Reconnects only when the wallet says it can do so
  // without a prompt; otherwise restores intent only.
  useEffect(() => {
    if (!autoConnect.enabled) return

    let cancelled = false

    void (async () => {
      try {
        const session = await readWalletSession(autoConnect.storage)
        if (!session || cancelled || !mountedRef.current) return

        const adapter = getWalletAdapter(session.wallet)

        const available = await adapter.isAvailable()
        if (cancelled || !mountedRef.current) return

        if (!available) {
          // The extension is gone. Keep the stored intent so the user can
          // reinstall and pick up where they left off.
          setRestoredWallet(session.wallet)
          return
        }

        const silent = adapter.canAutoConnect ? await adapter.canAutoConnect(network) : false
        if (cancelled || !mountedRef.current) return

        if (!silent) {
          setRestoredWallet(session.wallet)
          safeSetWallet(prev => ({
            ...prev,
            wallet: session.wallet,
            walletName: adapter.metadata.name,
            ...(session.address ? { address: session.address } : {}),
          }))
          return
        }

        await connect(session.wallet)
      } catch {
        // A wallet that cannot be restored is not an error the user caused —
        // they simply start from a disconnected UI.
        void writeWalletSession(autoConnect.storage, null)
      }
    })()

    return () => {
      cancelled = true
    }
    // `connect` is intentionally read once: restore happens on mount only, and
    // re-running it whenever the callback identity changes would reconnect on
    // every network prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session restore ignores callback identity changes that would reconnect on network updates.
  }, [autoConnect.enabled, autoConnect.storage])

  // ── Wallet change events ─────────────────────────────────────────────────
  // Subscribes through the adapter contract. Adapters that cannot report
  // changes omit `subscribe`, so nothing here branches on wallet type.
  useEffect(() => {
    // Gated on "not a server render" rather than on having a DOM: a native app
    // has no DOM, but its WalletConnect sessions still report changes.
    if (!wallet.connected || !wallet.wallet || platform.isServer) return

    let adapter: WalletAdapter
    try {
      adapter = getWalletAdapter(wallet.wallet)
    } catch {
      return
    }

    if (!adapter.subscribe) return

    const handleChange = (change: WalletChange) => {
      if (!mountedRef.current) return

      if (change.disconnected) {
        // The wallet ended the session; mirror `disconnect()` without calling
        // back into the adapter, which has nothing left to close.
        setRestoredWallet(null)
        void writeWalletSession(autoConnect.storage, null)
        safeSetWallet(DISCONNECTED_WALLET)
        return
      }

      safeSetWallet(prev => {
        if (!prev.connected) return prev

        return {
          ...prev,
          address: change.address ?? prev.address,
          walletNetwork: change.network,
          walletNetworkPassphrase: change.networkPassphrase,
        }
      })
    }

    const unsubscribe = adapter.subscribe(handleChange)

    return () => {
      unsubscribe()
    }
  }, [wallet.connected, wallet.wallet, safeSetWallet, platform.isServer, autoConnect.storage])

  const isNetworkMismatch = useMemo(() => {
    if (!wallet.connected || !wallet.walletNetwork) return false
    return wallet.network !== wallet.walletNetwork
  }, [wallet.connected, wallet.network, wallet.walletNetwork])

  return {
    ...wallet,
    connect,
    disconnect,
    refreshWalletNetwork,
    isNetworkMismatch,
    restoredWallet,
  }
}
