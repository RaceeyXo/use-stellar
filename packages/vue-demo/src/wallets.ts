import {
  createWalletConnectAdapter,
  freighterAdapter,
  rabetAdapter,
  registerWalletAdapter,
  type WalletType,
} from "use-stellar/core"

/** A wallet the demo offers, and why it cannot be used when it cannot. */
export interface DemoWallet {
  id: WalletType
  label: string
  /** Set when the wallet is not registered in this build. Shown next to its disabled button. */
  unavailable?: string
}

/**
 * WalletConnect needs a project id from https://cloud.reown.com. It is read
 * from the environment so that none is committed; without one the demo still
 * runs and says why the WalletConnect button is off.
 */
const walletConnectProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim()

/**
 * Registers the wallets the demo offers. `use-stellar/core` registers no
 * browser wallet by itself, so an app registers each one it wants, once, at
 * startup.
 */
export function registerDemoWallets(): DemoWallet[] {
  registerWalletAdapter(freighterAdapter, { override: true })
  registerWalletAdapter(rabetAdapter, { override: true })

  const wallets: DemoWallet[] = [
    { id: "freighter", label: "Freighter" },
    { id: "rabet", label: "Rabet" },
  ]

  if (walletConnectProjectId) {
    registerWalletAdapter(
      createWalletConnectAdapter({
        projectId: walletConnectProjectId,
        metadata: {
          name: "use-stellar Vue demo",
          description: "The use-stellar Vue composables on Stellar testnet.",
          url: window.location.origin,
          icons: [],
        },
      }),
      { override: true }
    )
    wallets.push({ id: "walletconnect", label: "WalletConnect" })
  } else {
    wallets.push({
      id: "walletconnect",
      label: "WalletConnect",
      unavailable: "Set VITE_WALLETCONNECT_PROJECT_ID to turn WalletConnect on. See the README.",
    })
  }

  return wallets
}
