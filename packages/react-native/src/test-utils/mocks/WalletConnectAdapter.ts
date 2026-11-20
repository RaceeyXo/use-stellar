/**
 * WalletConnect Wallet Adapter Mock
 * ─────────────────────────────────
 * Bridges the controllable WalletConnect client mock (`./WalletConnect`) into
 * core's wallet registry, so write hooks (`useSendPayment`, `useAddTrustline`,
 * `usePathPayment`) can sign through it exactly as they would through the real
 * WalletConnect adapter — without loading `@walletconnect/*` or touching the
 * network.
 *
 * Signing goes through the mocked client: it throws if the mock session is not
 * connected, and a test can hold the signature open (see `holdNextSignature`)
 * to simulate the user being in the wallet app while this app is backgrounded.
 *
 * The mock client returns a fake signature, not a signed envelope. Core parses
 * whatever the adapter returns back into a transaction, so the adapter hands
 * back the XDR it was given: the hook's own build/parse round trip stays real.
 */

import { registerWalletAdapter, getNetworkPassphrase } from "use-stellar"
import type { StellarNetwork, WalletAdapter } from "use-stellar"
import { TESTNET_ADDRESS_A } from "@stellar/stellar-sdk"
import { setWalletConnectConnected, signWithWalletConnect } from "./WalletConnect"

export interface MockWalletConnectAdapterHandle {
  adapter: WalletAdapter
  /** XDR envelopes passed to the adapter for signing, in call order. */
  signedXdrs: string[]
  /**
   * Makes the next `signTransaction` call wait until the returned `release`
   * function is called, then reject with `error` if one is given.
   */
  holdNextSignature: () => { release: (error?: Error) => void }
}

/** Builds the adapter without registering it. */
export function createMockWalletConnectAdapter(
  address: string = TESTNET_ADDRESS_A
): MockWalletConnectAdapterHandle {
  const signedXdrs: string[] = []
  let pendingHold: Promise<void> | null = null

  const adapter: WalletAdapter = {
    metadata: {
      type: "walletconnect",
      name: "WalletConnect (mock)",
      supported: true,
      platforms: ["native"],
    },
    async isAvailable() {
      return true
    },
    async connect(network: StellarNetwork) {
      await setWalletConnectConnected(true)
      return {
        address,
        wallet: "walletconnect",
        network,
        networkPassphrase: getNetworkPassphrase(network) ?? "",
      }
    },
    async disconnect() {
      await setWalletConnectConnected(false)
    },
    async getNetworkDetails(network: StellarNetwork) {
      return { network, networkPassphrase: getNetworkPassphrase(network) ?? "" }
    },
    async signTransaction(xdr: string) {
      signedXdrs.push(xdr)
      if (pendingHold) {
        const hold = pendingHold
        pendingHold = null
        await hold
      }
      await signWithWalletConnect(xdr)
      return xdr
    },
  }

  return {
    adapter,
    signedXdrs,
    holdNextSignature() {
      let release!: (error?: Error) => void
      pendingHold = new Promise<void>((resolve, reject) => {
        release = (error?: Error) => (error ? reject(error) : resolve())
      })
      // The hold is awaited inside signTransaction; avoid an unhandled
      // rejection if a test releases with an error before that await runs.
      pendingHold.catch(() => undefined)
      return { release }
    },
  }
}

/** Registers a fresh mock adapter under the `walletconnect` type. */
export function registerMockWalletConnectAdapter(address?: string): MockWalletConnectAdapterHandle {
  const handle = createMockWalletConnectAdapter(address)
  registerWalletAdapter(handle.adapter, { override: true })
  return handle
}
