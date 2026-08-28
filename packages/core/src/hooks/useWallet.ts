import { useCallback, useEffect, useMemo, useRef } from "react"
import { useStellarContext, WALLET_SESSION_STORAGE_KEY } from "../context/StellarProvider"
import { isBrowser } from "../utils"
import type { AutoConnectOptions, WalletState, WalletType } from "../types"
import { createStellarError, toStellarError } from "../errors"
import { getWalletAdapter, hasWalletAdapter } from "../wallets"
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

/** The shape persisted to storage. Nothing here is secret. */
interface PersistedSession {
  wallet: string
  address?: string
}

function getStorage(kind: AutoConnectOptions["storage"]): Storage | null {
  if (!isBrowser()) return null

  try {
    // Accessing `localStorage` itself throws in sandboxed iframes and some
    // private-mode contexts — not just reading from it.
    return kind === "session" ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

/**
 * Reads the persisted session, discarding anything that is not a well-formed
 * record naming a wallet that is actually registered.
 *
 * A stored value is attacker-influenced input in an XSS scenario, so it is
 * validated before it ever reaches the registry.
 */
function readSession(kind: AutoConnectOptions["storage"]): PersistedSession | null {
  const storage = getStorage(kind)
  if (!storage) return null

  try {
    const raw = storage.getItem(WALLET_SESSION_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null

    const { wallet, address } = parsed as Record<string, unknown>
    if (typeof wallet !== "string" || !hasWalletAdapter(wallet)) return null

    return {
      wallet,
      address: typeof address === "string" ? address : undefined,
    }
  } catch {
    return null
  }
}

function writeSession(kind: AutoConnectOptions["storage"], session: PersistedSession | null): void {
  const storage = getStorage(kind)
  if (!storage) return

  try {
    if (session) {
      storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(session))
    } else {
      storage.removeItem(WALLET_SESSION_STORAGE_KEY)
    }
  } catch {
    // Quota exceeded, or storage disabled mid-session. Losing the ability to
    // restore a session is never a reason to break the app.
  }
}

/**
 * Resolves the network a wallet is actually on, through the adapter.
 *
 * Adapters that cannot report a current network (Albedo confirms per-request)
 * have no `resolveNetwork`, so the requested network stands.
 */
async function resolveWalletNetwork(
  adapter: WalletAdapter,
  fallback: WalletState["walletNetwork"],
  fallbackPassphrase: string | null
): Promise<Pick<WalletState, "walletNetwork" | "walletNetworkPassphrase">> {
  if (!adapter.resolveNetwork) {
    return { walletNetwork: fallback, walletNetworkPassphrase: fallbackPassphrase }
  }

  const state = await adapter.resolveNetwork()
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
  const { wallet, setWallet, network, autoConnect } = useStellarContext()

  // Tracks whether this hook is still mounted, so a late wallet response or a
  // watcher tick can never call setWallet on an unmounted component.
  const mountedRef = useRef(true)
  const restoredWalletRef = useRef<WalletType | null>(null)

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
      if (!isBrowser()) {
        safeSetWallet(prev => ({
          ...prev,
          error: createStellarError(
            "VALIDATION_ERROR",
            "Wallet connection is only available in the browser. " +
              'Move your component to a "use client" boundary in Next.js / Remix.'
          ),
        }))
        return
      }

      safeSetWallet(prev => ({ ...prev, connecting: true, error: null }))

      try {
        const adapter = getWalletAdapter(walletType)
        const connection = await adapter.connect(network)

        // The wallet's own network, not the one we asked for — otherwise the
        // mismatch check compares a value with itself and never fires.
        const walletNetwork = await resolveWalletNetwork(
          adapter,
          connection.network,
          connection.networkPassphrase
        )

        safeSetWallet({
          connected: true,
          connecting: false,
          address: connection.address,
          network: connection.network,
          wallet: connection.wallet,
          walletName: adapter.metadata.name,
          error: null,
          ...walletNetwork,
        })

        restoredWalletRef.current = null

        if (autoConnect.enabled) {
          writeSession(autoConnect.storage, {
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
    [safeSetWallet, network, autoConnect.enabled, autoConnect.persistAddress, autoConnect.storage]
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

    restoredWalletRef.current = null
    writeSession(autoConnect.storage, null)

    safeSetWallet({
      connected: false,
      connecting: false,
      address: null,
      network: null,
      wallet: null,
      walletName: null,
      error: null,
      walletNetwork: null,
      walletNetworkPassphrase: null,
    })
  }, [safeSetWallet, wallet.wallet, autoConnect.storage])

  const refreshWalletNetwork = useCallback(async () => {
    if (!wallet.connected || !wallet.wallet) {
      return
    }

    try {
      const adapter = getWalletAdapter(wallet.wallet)
      const resolved = await resolveWalletNetwork(
        adapter,
        wallet.walletNetwork,
        wallet.walletNetworkPassphrase ?? null
      )

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
  }, [
    wallet.connected,
    wallet.wallet,
    wallet.walletNetwork,
    wallet.walletNetworkPassphrase,
    safeSetWallet,
  ])

  // ── Session restore ──────────────────────────────────────────────────────
  // Runs once per mount. Reconnects only when the wallet says it can do so
  // without a prompt; otherwise restores intent only.
  useEffect(() => {
    if (!autoConnect.enabled || !isBrowser()) return

    const session = readSession(autoConnect.storage)
    if (!session) return

    let cancelled = false

    void (async () => {
      try {
        const adapter = getWalletAdapter(session.wallet)

        const available = await adapter.isAvailable()
        if (cancelled || !mountedRef.current) return

        if (!available) {
          // The extension is gone. Keep the stored intent so the user can
          // reinstall and pick up where they left off.
          restoredWalletRef.current = session.wallet
          return
        }

        const silent = adapter.canAutoConnect ? await adapter.canAutoConnect() : false
        if (cancelled || !mountedRef.current) return

        if (!silent) {
          restoredWalletRef.current = session.wallet
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
        writeSession(autoConnect.storage, null)
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
    if (!wallet.connected || !wallet.wallet || !isBrowser()) return

    let adapter: WalletAdapter
    try {
      adapter = getWalletAdapter(wallet.wallet)
    } catch {
      return
    }

    if (!adapter.subscribe) return

    const handleChange = (change: WalletChange) => {
      if (!mountedRef.current) return

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
  }, [wallet.connected, wallet.wallet, safeSetWallet])

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
    restoredWallet: restoredWalletRef.current,
  }
}
