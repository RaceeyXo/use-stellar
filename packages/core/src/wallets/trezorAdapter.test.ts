import * as StellarSDK from "@stellar/stellar-sdk"
import { trezorAdapter, configureTrezorAdapter } from "./trezorAdapter"
import { NETWORK_PASSPHRASES } from "./constants"

jest.mock("@trezor/connect", () => ({
  init: jest.fn(),
  stellarGetAddress: jest.fn(),
  stellarSignTransaction: jest.fn(),
}))

const mockTrezorConnect = jest.requireMock("@trezor/connect") as {
  init: jest.Mock
  stellarGetAddress: jest.Mock
  stellarSignTransaction: jest.Mock
}

describe("trezorAdapter", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.resetModules()
    // Reset the adapter's internal state by re-importing
    jest.clearAllMocks()
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
          address: "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV",
          path: [2147483692, 2147483796, 2147483648],
          serializedPath: "m/44'/148'/0'",
        },
      })

      const result = await trezorAdapter.connect("testnet")

      expect(result).toEqual({
        address: "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV",
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
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(
        new Error("Device not found")
      )

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
      await expect(
        trezorAdapter.connect("custom" as any)
      ).rejects.toMatchObject({
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
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"
      const signature =
        "9405d807b707e969aa08b33a9b02e7f60fabc2e0d8f2c37b53be7d07e7c6c32b1b6f7b3cff8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f"

      // Create a valid test transaction
      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: {
          publicKey,
          signature,
        },
      })

      const signedXdr = await trezorAdapter.signTransaction(tx.toXDR(), {
        address: publicKey,
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      // Verify the signature was attached
      expect(signedXdr).toBeTruthy()
      const signedTx = StellarSDK.Transaction.fromXDR(
        signedXdr,
        NETWORK_PASSPHRASES.testnet
      )
      expect(signedTx.signatures.length).toBeGreaterThan(0)

      // Verify the signature can be verified
      expect(
        signedTx.signatures.some(sig => sig.signature() === signature)
      ).toBe(true)
    })

    it("passes the exact network passphrase to Trezor", async () => {
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"
      const signature =
        "9405d807b707e969aa08b33a9b02e7f60fabc2e0d8f2c37b53be7d07e7c6c32b1b6f7b3cff8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: {
          publicKey,
          signature,
        },
      })

      await trezorAdapter.signTransaction(tx.toXDR(), {
        address: publicKey,
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      // Verify the exact passphrase was passed
      expect(mockTrezorConnect.stellarSignTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      )
    })

    it("throws wallet_sign_failed when Trezor returns an error", async () => {
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
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
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockRejectedValue(
        new Error("User rejected signing")
      )

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
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
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
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
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
      await expect(
        trezorAdapter.getNetworkDetails("custom" as any)
      ).rejects.toMatchObject({
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
    it("does not load @trezor/connect at module import time", () => {
      // This test verifies that importing trezorAdapter doesn't trigger SDK loading
      jest.resetModules()
      jest.clearAllMocks()

      // Import the adapter without calling any methods
      require("./trezorAdapter")

      // The mock should not have been called
      expect(mockTrezorConnect.init).not.toHaveBeenCalled()
    })

    it("loads @trezor/connect only when connect is called", async () => {
      jest.resetModules()
      jest.clearAllMocks()

      // Import fresh adapter
      const { trezorAdapter: adapter, configureTrezorAdapter: configure } =
        await import("./trezorAdapter")

      configure({
        email: "contact@example.com",
        appUrl: "https://example.com",
      })

      mockTrezorConnect.init.mockResolvedValue(undefined)
      mockTrezorConnect.stellarGetAddress.mockResolvedValue({
        success: true,
        payload: {
          address: "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV",
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
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(
        new Error("action cancelled")
      )

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })

    it("maps 'not found' error to wallet_unavailable", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(
        new Error("Device not found")
      )

      await expect(trezorAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
      })
    })

    it("maps 'bridge' error to wallet_unavailable", async () => {
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(
        new Error("Bridge is not running")
      )

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
      mockTrezorConnect.stellarGetAddress.mockRejectedValue(
        new Error("Unknown error")
      )

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
          address: "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV",
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
      const publicKey = "GAXSFOOGF4ELO5HT5PTN23T5XE6D5QWL3YBHSVQ2HWOFEJNYYMRJENBV"
      const signature =
        "9405d807b707e969aa08b33a9b02e7f60fabc2e0d8f2c37b53be7d07e7c6c32b1b6f7b3cff8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f7f8f"

      const account = new StellarSDK.Account(publicKey, "0")
      const txBuilder = new StellarSDK.TransactionBuilder(account, {
        fee: 100,
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const tx = txBuilder
        .addOperation(
          StellarSDK.Operation.payment({
            destination: "GBBD47UZQ5DKWMLXQJFVJZB7WYXBNRXL3NCQPYQZ4W4M3CVYHXC6BPHP",
            asset: StellarSDK.Asset.native(),
            amount: "100",
          })
        )
        .setTimeout(300)
        .build()

      mockTrezorConnect.stellarSignTransaction.mockResolvedValue({
        success: true,
        payload: {
          publicKey,
          signature,
        },
      })

      const result = await trezorAdapter.signTransaction(tx.toXDR(), {
        address: publicKey,
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      expect(typeof result).toBe("string")
      // Verify it's valid XDR by attempting to parse it
      expect(() => {
        StellarSDK.Transaction.fromXDR(result, NETWORK_PASSPHRASES.testnet)
      }).not.toThrow()
    })
  })
})
