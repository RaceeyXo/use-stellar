import { hotWalletAdapter } from "./hotWalletAdapter"
import { NETWORK_PASSPHRASES } from "./constants"

jest.mock("@hot-wallet/sdk", () => ({
  HOT: {
    request: jest.fn(),
  },
}))

const mockRequest = jest.fn()

// Get the mocked module to set up request mock
beforeAll(() => {
  const mockHot = jest.requireMock("@hot-wallet/sdk") as { HOT: { request: jest.Mock } }
  mockHot.HOT.request = mockRequest
})

describe("hotWalletAdapter", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockRequest.mockReset()
  })

  describe("metadata", () => {
    it("has the correct metadata", () => {
      expect(hotWalletAdapter.metadata).toEqual({
        type: "hot",
        name: "HOT Wallet",
        supported: true,
        platforms: ["web", "native"],
      })
    })
  })

  describe("connect", () => {
    it("connects and returns the approved Stellar address", async () => {
      mockRequest.mockResolvedValueOnce({
        address: "GABC123",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const result = await hotWalletAdapter.connect("testnet")

      expect(result).toMatchObject({
        address: "GABC123",
        wallet: "hot",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      // Verify the SDK was called with the correct method
      expect(mockRequest).toHaveBeenCalledWith("stellar:getAddress", {})
    })

    it("throws wallet_access_rejected when user rejects the connection", async () => {
      mockRequest.mockRejectedValueOnce(new Error("Connection rejected by user"))

      await expect(hotWalletAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })

    it("throws wallet_access_rejected when no address is returned", async () => {
      mockRequest.mockResolvedValueOnce({})

      await expect(hotWalletAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
        message: expect.stringContaining("did not return a Stellar address"),
      })
    })
  })

  describe("signTransaction", () => {
    it("signs transactions with the explicit passphrase", async () => {
      mockRequest.mockResolvedValueOnce({
        signedXdr: "signed-envelope-xdr-here",
      })

      const result = await hotWalletAdapter.signTransaction("raw-xdr", {
        address: "GABC123",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      expect(result).toBe("signed-envelope-xdr-here")

      // Verify the passphrase was passed to the SDK
      expect(mockRequest).toHaveBeenCalledWith("stellar:signTransaction", {
        xdr: "raw-xdr",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    })

    it("supports signed_envelope_xdr response format", async () => {
      mockRequest.mockResolvedValueOnce({
        signed_envelope_xdr: "another-signed-xdr",
      })

      const result = await hotWalletAdapter.signTransaction("raw-xdr", {
        address: "GABC123",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      expect(result).toBe("another-signed-xdr")
    })

    it("throws wallet_network_mismatch when no passphrase is provided", async () => {
      await expect(
        hotWalletAdapter.signTransaction("raw-xdr", {
          address: "GABC123",
          network: "testnet",
          networkPassphrase: "",
        })
      ).rejects.toMatchObject({
        code: "wallet_network_mismatch",
      })

      // Verify the SDK was not called
      expect(mockRequest).not.toHaveBeenCalled()
    })

    it("throws wallet_sign_failed when signing fails", async () => {
      mockRequest.mockRejectedValueOnce(new Error("Signing operation failed"))

      await expect(
        hotWalletAdapter.signTransaction("raw-xdr", {
          address: "GABC123",
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_sign_failed",
      })
    })

    it("throws wallet_sign_failed when no signed XDR is returned", async () => {
      mockRequest.mockResolvedValueOnce({})

      await expect(
        hotWalletAdapter.signTransaction("raw-xdr", {
          address: "GABC123",
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_sign_failed",
        message: expect.stringContaining("did not return a signed transaction"),
      })
    })
  })

  describe("getNetworkDetails", () => {
    it("returns the requested network details", async () => {
      const result = await hotWalletAdapter.getNetworkDetails("testnet")

      expect(result).toEqual({
        network: "testnet",
        networkPassphrase: "",
      })
    })
  })

  describe("error mapping", () => {
    it("maps 'cancelled' messages to wallet_access_rejected", async () => {
      mockRequest.mockRejectedValueOnce(new Error("User cancelled the operation"))

      await expect(hotWalletAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })

    it("maps 'not connected' messages to wallet_unavailable", async () => {
      mockRequest.mockRejectedValueOnce(new Error("Wallet not connected"))

      await expect(hotWalletAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
      })
    })

    it("maps 'network' messages to wallet_network_mismatch", async () => {
      mockRequest.mockRejectedValueOnce(new Error("Invalid network specified"))

      await expect(
        hotWalletAdapter.signTransaction("raw-xdr", {
          address: "GABC123",
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_network_mismatch",
      })
    })

    it("maps unknown errors to wallet_sign_failed by default", async () => {
      mockRequest.mockRejectedValueOnce(new Error("Something went wrong"))

      await expect(
        hotWalletAdapter.signTransaction("raw-xdr", {
          address: "GABC123",
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
      ).rejects.toMatchObject({
        code: "wallet_sign_failed",
      })
    })
  })

  describe("native runtime", () => {
    let originalNavigator: unknown

    beforeEach(() => {
      originalNavigator = global.navigator
      Object.defineProperty(global, "navigator", {
        value: { product: "ReactNative" },
        writable: true,
      })
    })

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      })
    })

    it("connect rejects with wallet_unavailable on React Native", async () => {
      await expect(hotWalletAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
        message: expect.stringContaining("React Native"),
      })
    })
  })

  describe("missing optional peer", () => {
    it("surfaces wallet_unavailable naming the package when the SDK is not installed", async () => {
      jest.resetModules()
      jest.doMock("@hot-wallet/sdk", () => {
        throw new Error("Cannot find module '@hot-wallet/sdk'")
      })

      const { hotWalletAdapter: freshAdapter } = await import("./hotWalletAdapter")

      await expect(freshAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_unavailable",
      })
      await expect(freshAdapter.connect("testnet")).rejects.toThrow("@hot-wallet/sdk")
    })
  })
})
