import * as StellarSDK from "@stellar/stellar-sdk"
import { trezorAdapter, configureTrezorAdapter } from "./trezorAdapter"
import { NETWORK_PASSPHRASES } from "./constants"

jest.mock(
  "@trezor/connect",
  () => ({
    init: jest.fn(),
    stellarGetAddress: jest.fn(),
    stellarSignTransaction: jest.fn(),
  }),
  { virtual: true }
)

const mockTrezorConnect = jest.requireMock("@trezor/connect") as {
  init: jest.Mock
  stellarGetAddress: jest.Mock
  stellarSignTransaction: jest.Mock
}

// The real SDK, by path: the package name is mapped to the core SDK mock, which
// does not carry a full Keypair.
const { Keypair } = jest.requireActual(
  "../../node_modules/@stellar/stellar-sdk/lib/index.js"
) as typeof StellarSDK

/**
 * A transaction and a real signature over it, as Trezor Connect returns them
 * (hex). The adapter verifies the signature against the signer, so a made-up
 * one would — correctly — be rejected.
 */
function signedFixture(networkPassphrase: string = NETWORK_PASSPHRASES.testnet) {
  const keypair = Keypair.random()
  const tx = new StellarSDK.TransactionBuilder(new StellarSDK.Account(keypair.publicKey(), "0"), {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      StellarSDK.Operation.payment({
        destination: keypair.publicKey(),
        asset: StellarSDK.Asset.native(),
        amount: "100",
      })
    )
    .setTimeout(300)
    .build()
  const signature = keypair.sign(tx.hash())

  return {
    address: keypair.publicKey(),
    xdr: tx.toXDR(),
    trezorPayload: {
      publicKey: keypair.rawPublicKey().toString("hex"),
      signature: signature.toString("hex"),
    },
    signatureBase64: signature.toString("base64"),
  }
}

describe("trezorAdapter", () => {
  beforeEach(() => {
    // Not `jest.resetModules()` here: the adapter is imported once at the top,
    // and a reset would hand its next import of `@trezor/connect` a fresh mock
    // instance — not the `mockTrezorConnect` these tests configure. Tests that
    // need a fresh adapter reset and re-import it themselves.
    jest.resetAllMocks()
  })

  describe("configuration", () => {
    it("throws wallet_unavailable when email is missing", () => {
      expect(() => {
        configureTrezorAdapter({
          email: "",
          appUrl: "https://example.com",
        })
      }).toThrow()
    })

    it("throws wallet_unavailable when appUrl is missing", () => {
      expect(() => {
        configureTrezorAdapter({
          email: "contact@example.com",
          appUrl: "",
        })
      }).toThrow()
    })

    it("accepts valid configuration", () => {
      expect(() => {
        configureTrezorAdapter({
          email: "contact@example.com",
          appUrl: "https://example.com",
        })
      }).not.toThrow()
    })
  })

  describe("isAvailable", () => {
    it("returns false in React Native environment", async () => {
      const originalNavigator = global.navigator
      Object.defineProperty(global, "navigator", {
        value: { product: "ReactNative" },
        writable: true,
      })

      try {
        const result = await trezorAdapter.isAvailable()
        expect(result).toBe(false)
      } finally {
        Object.defineProperty(global, "navigator", {
          value: originalNavigator,
          writable: true,
        })
      }
    })

    it("returns true when Trezor is available and configured", async () => {
      configureTrezorAdapter({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })

      mockTrezorConnect.init.mockResolvedValue(undefined)

      const result = await trezorAdapter.isAvailable()
      expect(result).toBe(true)
    })

    it("returns false when Trezor is not available", async () => {
      // Don't configure, so loading fails
      jest.resetModules()
      const { trezorAdapter: adapter } = await import("./trezorAdapter")

      const result = await adapter.isAvailable()
      expect(result).toBe(false)
    })
  })

  describe("connect", () => {
    beforeEach(() => {
      configureTrezorAdapter({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })
      mockTrezorConnect.init.mockResolvedValue(undefined)
    })

    it("returns a connection with the Trezor address", async () => {
      mockTrezorConnect.stellarGetAddress.mockResolvedValue({
        success: true,
        payload: {
          address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
          path: [2147483692, 2147483796, 2147483648],
          serializedPath: "m/44'/148'/0'",
        },
      })

      const result = await trezorAdapter.connect("testnet")

      expect(result).toEqual({
        address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        wallet: "trezor",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      expect(mockTrezorConnect.stellarGetAddress).toHaveBeenCalledWith({
        path: "m/44'/148'/0'",
        showOnTrezor: true,
      })
    })

    it("throws wallet_access_rejected when user cancels on device", async () => {
      mockTrezorConnect.stellarGetAddress.mockResolvedValue({
        success: false,
        payload: {
          error: "User cancelled the operation",
        },
      })

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })

    it("throws wallet_unavailable when device is not found", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(new Error("Device not found"))

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
      })
    })

    it("throws wallet_unavailable in React Native environment", async () => {
      const originalNavigator = global.navigator
      Object.defineProperty(global, "navigator", {
        value: { product: "ReactNative" },
        writable: true,
      })

      try {
        await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
          code: "wallet_unavailable",
          message: expect.stringContaining("native app"),
        })
      } finally {
        Object.defineProperty(global, "navigator", {
          value: originalNavigator,
          writable: true,
        })
      }
    })

    it("throws wallet_unsupported for unknown networks", async () => {
      await expect(trezorAdapter.connect("custom")).rejects.toMatchObject({
        code: "wallet_unsupported",
      })
    })
  })

  describe("signTransaction", () => {
    beforeEach(() => {
      configureTrezorAdapter({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })
      mockTrezorConnect.init.mockResolvedValue(undefined)
    })

    it("signs a transaction and returns a valid signed XDR", async () => {
      const fixture = signedFixture()
      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: fixture.trezorPayload,
      })

      const signedXdr = await trezorAdapter.signTransaction(fixture.xdr, {
        address: fixture.address,
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const signedTx = StellarSDK.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASES.testnet)
      expect(signedTx.signatures).toHaveLength(1)
      expect(signedTx.signatures[0].signature().toString("base64")).toBe(fixture.signatureBase64)
    })

    it("rejects a signature that is not from the signing account", async () => {
      const fixture = signedFixture()
      const other = signedFixture()
      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: other.trezorPayload,
      })

      await expect(
        trezorAdapter.signTransaction(fixture.xdr, {
          address: fixture.address,
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({ code: "wallet_sign_failed" })
    })

    it("passes the exact network passphrase to Trezor", async () => {
      const fixture = signedFixture()
      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: fixture.trezorPayload,
      })

      await trezorAdapter.signTransaction(fixture.xdr, {
        address: fixture.address,
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      expect(mockTrezorConnect.stellarSignTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      )
    })

    it("throws wallet_sign_failed when Trezor returns an error", async () => {
      const publicKey = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: false,
        payload: {
          error: "Signing failed",
        },
      })

      await expect(
        trezorAdapter.signTransaction(tx.toXDR(), {
          address: publicKey,
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_sign_failed",
      })
    })

    it("throws wallet_access_rejected when user rejects signing", async () => {
      const publicKey = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockRejectedValue(new Error("User rejected signing"))

      await expect(
        trezorAdapter.signTransaction(tx.toXDR(), {
          address: publicKey,
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })

    it("throws wallet_network_mismatch when network passphrase doesn't match device", async () => {
      const publicKey = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockRejectedValue(
        new Error("Network passphrase mismatch")
      )

      await expect(
        trezorAdapter.signTransaction(tx.toXDR(), {
          address: publicKey,
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_network_mismatch",
      })
    })

    it("throws wallet_sign_failed when network passphrase is missing", async () => {
      const publicKey = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      await expect(
        trezorAdapter.signTransaction(tx.toXDR(), {
          address: publicKey,
          network: "testnet",
          networkPassphrase: "", // Missing passphrase
        })
      ).rejects.toMatchObject({
        code: "wallet_sign_failed",
      })
    })
  })

  describe("getNetworkDetails", () => {
    it("returns network details for testnet", async () => {
      const details = await trezorAdapter.getNetworkDetails("testnet")

      expect(details).toEqual({
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    })

    it("returns network details for mainnet", async () => {
      const details = await trezorAdapter.getNetworkDetails("mainnet")

      expect(details).toEqual({
        network: "mainnet",
        networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      })
    })

    it("throws wallet_unsupported for unknown networks", async () => {
      await expect(trezorAdapter.getNetworkDetails("custom")).rejects.toMatchObject({
        code: "wallet_unsupported",
      })
    })
  })

  describe("metadata", () => {
    it("exposes correct metadata", () => {
      expect(trezorAdapter.metadata).toEqual({
        type: "trezor",
        name: "Trezor",
        supported: true,
        platforms: ["web"],
      })
    })
  })

  describe("lazy loading", () => {
    it("does not load @trezor/connect at module import time", async () => {
      // This test verifies that importing trezorAdapter doesn't trigger SDK loading
      jest.resetModules()
      jest.clearAllMocks()

      // Import the adapter without calling any methods
      await import("./trezorAdapter")

      // The mock should not have been called
      expect(mockTrezorConnect.init).not.toHaveBeenCalled()
    })

    it("loads @trezor/connect only when connect is called", async () => {
      jest.resetModules()
      jest.clearAllMocks()

      // Import fresh adapter — and the fresh @trezor/connect mock it will load.
      const { trezorAdapter: adapter, configureTrezorAdapter: configure } =
        await import("./trezorAdapter")
      const mockTrezorConnect = jest.requireMock("@trezor/connect") as {
        init: jest.Mock
        stellarGetAddress: jest.Mock
      }

      configure({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })

      mockTrezorConnect.init.mockResolvedValue(undefined)
      mockTrezorConnect.stellarGetAddress.mockResolvedValue({
        success: true,
        payload: {
          address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        },
      })

      // init should not have been called yet
      expect(mockTrezorConnect.init).not.toHaveBeenCalled()

      // Call connect
      await adapter.connect("testnet")

      // Now init should have been called
      expect(mockTrezorConnect.init).toHaveBeenCalled()
    })
  })

  describe("error mapping", () => {
    beforeEach(() => {
      configureTrezorAdapter({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })
      mockTrezorConnect.init.mockResolvedValue(undefined)
    })

    it("maps 'cancelled' error to wallet_access_rejected", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(new Error("action cancelled"))

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })

    it("maps 'not found' error to wallet_unavailable", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(new Error("Device not found"))

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
      })
    })

    it("maps 'bridge' error to wallet_unavailable", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(new Error("Bridge is not running"))

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
      })
    })

    it("maps 'passphrase' error to wallet_network_mismatch", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(
        new Error("Network passphrase mismatch")
      )

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_network_mismatch",
      })
    })

    it("defaults to wallet_sign_failed for unmapped errors", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(new Error("Unknown error"))

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_sign_failed",
      })
    })
  })

  describe("adapter contract compliance", () => {
    beforeEach(() => {
      configureTrezorAdapter({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })
      mockTrezorConnect.init.mockResolvedValue(undefined)
    })

    it("implements required WalletAdapter methods", () => {
      expect(typeof trezorAdapter.metadata).toBe("object")
      expect(typeof trezorAdapter.isAvailable).toBe("function")
      expect(typeof trezorAdapter.connect).toBe("function")
      expect(typeof trezorAdapter.getNetworkDetails).toBe("function")
      expect(typeof trezorAdapter.signTransaction).toBe("function")
    })

    it("connect returns WalletConnection with required fields", async () => {
      mockTrezorConnect.stellarGetAddress.mockResolvedValue({
        success: true,
        payload: {
          address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        },
      })

      const connection = await trezorAdapter.connect("testnet")

      expect(connection).toHaveProperty("address")
      expect(connection).toHaveProperty("wallet")
      expect(connection).toHaveProperty("network")
      expect(connection).toHaveProperty("networkPassphrase")

      expect(connection.wallet).toBe("trezor")
      expect(connection.address).toBeTruthy()
    })

    it("signTransaction returns a valid XDR string", async () => {
      const fixture = signedFixture()
      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: fixture.trezorPayload,
      })

      const result = await trezorAdapter.signTransaction(fixture.xdr, {
        address: fixture.address,
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      expect(typeof result).toBe("string")
      expect(() => {
        StellarSDK.TransactionBuilder.fromXDR(result, NETWORK_PASSPHRASES.testnet)
      }).not.toThrow()
    })
  })
})
