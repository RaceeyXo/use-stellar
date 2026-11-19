import type { StellarNetwork, WalletType } from "../../types"
import type {
  SignTransactionOptions,
  WalletAdapter,
  WalletAdapterErrorCode,
  WalletChange,
  WalletNetworkState,
} from "../types"

type MaybePromise = void | Promise<void>

export interface WalletAdapterErrorCase {
  arrange: () => MaybePromise
  code: WalletAdapterErrorCode
}

export interface WalletAdapterSubscriptionFake {
  arrange?: () => MaybePromise
  change: WalletChange
  emit: () => void
  expectUnsubscribed: () => void
}

export interface WalletAdapterConformanceFakes {
  reset: () => MaybePromise
  arrangeAvailable: () => MaybePromise
  arrangeConnect: () => MaybePromise
  arrangeSign: () => MaybePromise
  expected: {
    type: WalletType
    name: string
    network: StellarNetwork
    networkPassphrase: string
    address: string
    signedXdr: string
  }
  unavailable?: WalletAdapterErrorCase & { arrangeAvailability: () => MaybePromise }
  accessRejected?: WalletAdapterErrorCase
  networkMismatch?: WalletAdapterErrorCase
  signRejected?: WalletAdapterErrorCase
  expectedResolvedNetwork?: WalletNetworkState
  expectedCanAutoConnect?: boolean
  subscription?: WalletAdapterSubscriptionFake
  expectSignRequest: (xdr: string, options: SignTransactionOptions) => void
}

/**
 * Runs the framework-neutral contract every wallet adapter must satisfy.
 * Vendor behavior is injected through `fakes`, so adding a wallet never
 * requires copying the assertions or leaking an SDK into this test kit.
 */
export function describeWalletAdapter(
  name: string,
  createAdapter: () => WalletAdapter,
  fakes: WalletAdapterConformanceFakes
): void {
  describe(`${name} wallet adapter contract`, () => {
    beforeEach(async () => {
      await fakes.reset()
    })

    test("exposes stable supported metadata", () => {
      const { metadata } = createAdapter()

      expect(metadata).toEqual(
        expect.objectContaining({
          type: fakes.expected.type,
          name: fakes.expected.name,
          supported: true,
        })
      )
      expect(metadata.platforms).toEqual(expect.arrayContaining(["web"]))
    })

    test("reports availability without changing adapter state", async () => {
      await fakes.arrangeAvailable()

      await expect(createAdapter().isAvailable()).resolves.toBe(true)
    })

    test("returns the canonical connection and network shapes", async () => {
      await fakes.arrangeConnect()
      const adapter = createAdapter()

      await expect(adapter.connect(fakes.expected.network)).resolves.toEqual({
        address: fakes.expected.address,
        wallet: fakes.expected.type,
        network: fakes.expected.network,
        networkPassphrase: fakes.expected.networkPassphrase,
      })
      await expect(adapter.getNetworkDetails(fakes.expected.network)).resolves.toEqual({
        network: fakes.expected.network,
        networkPassphrase: fakes.expected.networkPassphrase,
      })
    })

    test("signs with exactly the caller-provided passphrase", async () => {
      await fakes.arrangeSign()
      const options: SignTransactionOptions = {
        address: fakes.expected.address,
        network: fakes.expected.network,
        networkPassphrase: fakes.expected.networkPassphrase,
      }

      await expect(createAdapter().signTransaction("raw-xdr", options)).resolves.toBe(
        fakes.expected.signedXdr
      )
      fakes.expectSignRequest("raw-xdr", options)
    })

    const unavailableTest = fakes.unavailable ? test : test.skip
    unavailableTest("maps an unavailable wallet to wallet_unavailable", async () => {
      await fakes.unavailable!.arrangeAvailability()
      await expect(createAdapter().isAvailable()).resolves.toBe(false)
      await fakes.unavailable!.arrange()
      await expect(createAdapter().connect(fakes.expected.network)).rejects.toMatchObject({
        code: fakes.unavailable!.code,
      })
    })

    const accessRejectedTest = fakes.accessRejected ? test : test.skip
    accessRejectedTest("maps a rejected connection to a typed error", async () => {
      await fakes.accessRejected!.arrange()
      await expect(createAdapter().connect(fakes.expected.network)).rejects.toMatchObject({
        code: fakes.accessRejected!.code,
      })
    })

    const networkMismatchTest = fakes.networkMismatch ? test : test.skip
    networkMismatchTest("maps a wrong network to wallet_network_mismatch", async () => {
      await fakes.networkMismatch!.arrange()
      await expect(createAdapter().connect(fakes.expected.network)).rejects.toMatchObject({
        code: fakes.networkMismatch!.code,
      })
    })

    const signRejectedTest = fakes.signRejected ? test : test.skip
    signRejectedTest("maps a signing failure to wallet_sign_failed", async () => {
      await fakes.signRejected!.arrange()
      await expect(
        createAdapter().signTransaction("raw-xdr", {
          address: fakes.expected.address,
          network: fakes.expected.network,
          networkPassphrase: fakes.expected.networkPassphrase,
        })
      ).rejects.toMatchObject({ code: fakes.signRejected!.code })
    })

    const adapter = createAdapter()
    const resolveNetworkTest = adapter.resolveNetwork ? test : test.skip
    resolveNetworkTest("returns the optional resolved network shape", async () => {
      await fakes.arrangeConnect()
      await expect(createAdapter().resolveNetwork!()).resolves.toEqual(
        fakes.expectedResolvedNetwork
      )
    })

    const autoConnectTest = adapter.canAutoConnect ? test : test.skip
    autoConnectTest("returns a boolean from optional auto-connect detection", async () => {
      await fakes.arrangeConnect()
      await expect(createAdapter().canAutoConnect!()).resolves.toBe(fakes.expectedCanAutoConnect)
    })

    const subscriptionTest = adapter.subscribe && fakes.subscription ? test : test.skip
    subscriptionTest("forwards changes and releases optional subscriptions", async () => {
      await fakes.subscription!.arrange?.()
      const handler = jest.fn()
      const unsubscribe = createAdapter().subscribe!(handler)

      fakes.subscription!.emit()
      expect(handler).toHaveBeenCalledWith(fakes.subscription!.change)

      unsubscribe()
      fakes.subscription!.expectUnsubscribed()
    })
  })
}
