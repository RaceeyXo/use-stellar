import { xbullAdapter } from "./xbullAdapter"
import { NETWORK_PASSPHRASES } from "./constants"

// Mock the xBull SDK
jest.mock("@creit.tech/xbull-wallet-connect", () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    sign: jest.fn(),
    closeConnections: jest.fn(),
  }))
})

const mockXBullWalletConnect = jest.requireMock("@creit.tech/xbull-wallet-connect")

describe("xbullAdapter", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("connects with xBull on the requested network", async () => {
    const mockBridge = {
      connect: jest.fn().mockResolvedValue("GABC"),
      sign: jest.fn(),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    const result = await xbullAdapter.connect("testnet")

    expect(result).toEqual({
      address: "GABC",
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      wallet: "xbull",
    })
    expect(mockBridge.connect).toHaveBeenCalled()
    expect(mockBridge.closeConnections).toHaveBeenCalled()
  })

  it("closes the connection even when connect succeeds", async () => {
    const mockBridge = {
      connect: jest.fn().mockResolvedValue("GABC"),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await xbullAdapter.connect("testnet")

    expect(mockBridge.closeConnections).toHaveBeenCalled()
  })

  it("throws wallet_access_rejected when user rejects connection", async () => {
    const mockBridge = {
      connect: jest.fn().mockRejectedValue(new Error("User rejected")),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await expect(xbullAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_access_rejected",
    })
  })

  it("throws wallet_access_rejected when xBull returns no public key", async () => {
    const mockBridge = {
      connect: jest.fn().mockResolvedValue(null),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await expect(xbullAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_access_rejected",
      message: expect.stringContaining("did not return a public key"),
    })
  })

  it("connects with mainnet", async () => {
    const mockBridge = {
      connect: jest.fn().mockResolvedValue("GABC"),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    const result = await xbullAdapter.connect("mainnet")

    expect(result).toMatchObject({
      network: "mainnet",
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    })
  })

  it("returns correct network details for testnet", async () => {
    const result = await xbullAdapter.getNetworkDetails("testnet")

    expect(result).toEqual({
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })
  })

  it("returns correct network details for mainnet", async () => {
    const result = await xbullAdapter.getNetworkDetails("mainnet")

    expect(result).toEqual({
      network: "mainnet",
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    })
  })

  it("throws wallet_unsupported for custom network without passphrase", async () => {
    await expect(xbullAdapter.getNetworkDetails("custom")).rejects.toMatchObject({
      code: "wallet_unsupported",
      message: expect.stringContaining("custom"),
    })
  })

  it("signs transactions through xBull", async () => {
    const mockBridge = {
      sign: jest.fn().mockResolvedValue("signed-xdr"),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    const signedXdr = await xbullAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })

    expect(signedXdr).toBe("signed-xdr")
    expect(mockBridge.sign).toHaveBeenCalledWith({
      xdr: "raw-xdr",
      publicKey: "GABC",
      network: "testnet",
    })
    expect(mockBridge.closeConnections).toHaveBeenCalled()
  })

  it("signs transactions with mainnet", async () => {
    const mockBridge = {
      sign: jest.fn().mockResolvedValue("signed-xdr"),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await xbullAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "mainnet",
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    })

    expect(mockBridge.sign).toHaveBeenCalledWith({
      xdr: "raw-xdr",
      publicKey: "GABC",
      network: "mainnet",
    })
  })

  it("closes the connection even when signing succeeds", async () => {
    const mockBridge = {
      sign: jest.fn().mockResolvedValue("signed-xdr"),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await xbullAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })

    expect(mockBridge.closeConnections).toHaveBeenCalled()
  })

  it("throws wallet_sign_failed when signing fails", async () => {
    const mockBridge = {
      sign: jest.fn().mockRejectedValue(new Error("Failed to sign transaction")),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await expect(
      xbullAdapter.signTransaction("raw-xdr", {
        address: "GABC",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    ).rejects.toMatchObject({
      code: "wallet_sign_failed",
    })
  })

  it("throws wallet_sign_failed when xBull returns no signed XDR", async () => {
    const mockBridge = {
      sign: jest.fn().mockResolvedValue(null),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await expect(
      xbullAdapter.signTransaction("raw-xdr", {
        address: "GABC",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    ).rejects.toMatchObject({
      code: "wallet_sign_failed",
      message: expect.stringContaining("did not return a signed transaction"),
    })
  })

  it("throws wallet_access_rejected when user rejects signing", async () => {
    const mockBridge = {
      sign: jest.fn().mockRejectedValue(new Error("User rejected the signing request")),
      closeConnections: jest.fn(),
    }
    mockXBullWalletConnect.mockImplementation(() => mockBridge)

    await expect(
      xbullAdapter.signTransaction("raw-xdr", {
        address: "GABC",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    ).rejects.toMatchObject({
      code: "wallet_access_rejected",
    })
  })
})

describe("xbullAdapter — metadata", () => {
  it("has correct metadata", () => {
    expect(xbullAdapter.metadata).toEqual({
      type: "xbull",
      name: "xBull",
      supported: true,
      platforms: ["web"],
    })
  })
})

describe("xbullAdapter — isAvailable", () => {
  it("returns true when SDK is available and in a browser", async () => {
    mockXBullWalletConnect.mockImplementation(() => ({
      connect: jest.fn(),
      sign: jest.fn(),
      closeConnections: jest.fn(),
    }))

    const available = await xbullAdapter.isAvailable()
    expect(available).toBe(true)
  })

  it("returns false when SDK is not available", async () => {
    mockXBullWalletConnect.mockImplementation(() => {
      throw new Error("Module not found")
    })

    const available = await xbullAdapter.isAvailable()
    expect(available).toBe(false)
  })
})

describe("xbullAdapter — missing optional peer", () => {
  it("surfaces wallet_unavailable naming the package when the SDK is not installed", async () => {
    jest.resetModules()
    jest.doMock("@creit.tech/xbull-wallet-connect", () => {
      throw new Error("Cannot find module '@creit.tech/xbull-wallet-connect'")
    })

    const { xbullAdapter: freshAdapter } = await import("./xbullAdapter")

    await expect(freshAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_unavailable",
      message: expect.stringContaining("@creit.tech/xbull-wallet-connect"),
    })
  })
})

describe("xbullAdapter — native runtime", () => {
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

  it("isAvailable returns false", async () => {
    await expect(xbullAdapter.isAvailable()).resolves.toBe(false)
  })

  it("connect rejects with wallet_unavailable", async () => {
    await expect(xbullAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_unavailable",
      message: expect.stringContaining("native app"),
    })
  })
})
