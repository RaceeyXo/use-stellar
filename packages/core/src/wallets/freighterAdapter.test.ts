import {
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api"
import { freighterAdapter } from "./freighterAdapter"
import { NETWORK_PASSPHRASES } from "./constants"
import { describeWalletAdapter } from "./testing/conformance"

const watch = jest.fn()
const stop = jest.fn()

jest.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: jest.fn(),
  isAllowed: jest.fn(),
  isConnected: jest.fn(),
  requestAccess: jest.fn(),
  signTransaction: jest.fn(),
  WatchWalletChanges: jest.fn().mockImplementation(() => ({ watch, stop })),
}))

const mockIsConnected = jest.mocked(isConnected)
const mockIsAllowed = jest.mocked(isAllowed)
const mockRequestAccess = jest.mocked(requestAccess)
const mockGetNetworkDetails = jest.mocked(getNetworkDetails)
const mockSignTransaction = jest.mocked(signTransaction)

let walletChangeListener:
  ((change: { address: string; network: string; networkPassphrase: string }) => void) | undefined

describeWalletAdapter("Freighter", () => freighterAdapter, {
  reset() {
    jest.clearAllMocks()
    walletChangeListener = undefined
    watch.mockImplementation(handler => {
      walletChangeListener = handler
      return {}
    })
  },
  arrangeAvailable() {
    mockIsConnected.mockResolvedValue({ isConnected: true })
  },
  arrangeConnect() {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockIsAllowed.mockResolvedValue({ isAllowed: true })
    mockRequestAccess.mockResolvedValue({ address: "GABC" })
    mockGetNetworkDetails.mockResolvedValue({
      network: "TESTNET",
      networkUrl: "https://horizon-testnet.stellar.org",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })
  },
  arrangeSign() {
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr", signerAddress: "GABC" })
  },
  expected: {
    type: "freighter",
    name: "Freighter",
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
    address: "GABC",
    signedXdr: "signed-xdr",
  },
  unavailable: {
    code: "wallet_unavailable",
    arrangeAvailability() {
      mockIsConnected.mockResolvedValue({ isConnected: false })
    },
    arrange() {
      mockIsConnected.mockResolvedValue({ isConnected: false })
    },
  },
  accessRejected: {
    code: "wallet_access_rejected",
    arrange() {
      mockIsConnected.mockResolvedValue({ isConnected: true })
      mockRequestAccess.mockResolvedValue({ address: "", error: { message: "Rejected" } })
    },
  },
  signRejected: {
    code: "wallet_sign_failed",
    arrange() {
      mockSignTransaction.mockResolvedValue({
        signedTxXdr: "",
        signerAddress: "GABC",
        error: { message: "Rejected" },
      })
    },
  },
  expectedResolvedNetwork: {
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  },
  expectedCanAutoConnect: true,
  subscription: {
    change: {
      address: "GCHANGED",
      network: "mainnet",
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    },
    emit() {
      walletChangeListener?.({
        address: "GCHANGED",
        network: "PUBLIC",
        networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      })
    },
    expectUnsubscribed() {
      expect(stop).toHaveBeenCalledTimes(1)
    },
  },
  expectSignRequest(xdr, options) {
    expect(mockSignTransaction).toHaveBeenCalledWith(xdr, {
      address: options.address,
      networkPassphrase: options.networkPassphrase,
    })
  },
})

describe("freighterAdapter", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("connects with Freighter on the requested network", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockResolvedValue({ address: "GABC" })
    mockGetNetworkDetails.mockResolvedValue({
      network: "TESTNET",
      networkUrl: "https://horizon-testnet.stellar.org",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })

    await expect(freighterAdapter.connect("testnet")).resolves.toEqual({
      address: "GABC",
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      wallet: "freighter",
    })
  })

  it("throws a typed error when Freighter is unavailable", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false })

    await expect(freighterAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_unavailable",
    })
  })

  it("reports the wallet network when it differs from the requested network", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true })
    mockRequestAccess.mockResolvedValue({ address: "GABC" })
    mockGetNetworkDetails.mockResolvedValue({
      network: "PUBLIC",
      networkUrl: "https://horizon.stellar.org",
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    })

    await expect(freighterAdapter.connect("testnet")).resolves.toMatchObject({
      network: "mainnet",
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    })
  })

  it("signs transactions through Freighter", async () => {
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr", signerAddress: "GABC" })

    await expect(
      freighterAdapter.signTransaction("raw-xdr", {
        address: "GABC",
        network: "testnet",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    ).resolves.toBe("signed-xdr")
  })
})

describe("freighterAdapter — missing optional peer", () => {
  it("surfaces wallet_unavailable naming the package when the SDK is not installed", async () => {
    jest.resetModules()
    jest.doMock("@stellar/freighter-api", () => {
      throw new Error("Cannot find module '@stellar/freighter-api'")
    })

    const { freighterAdapter: freshAdapter } = await import("./freighterAdapter")

    await expect(freshAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_unavailable",
    })
    await expect(freshAdapter.connect("testnet")).rejects.toThrow("@stellar/freighter-api")
  })
})

describe("freighterAdapter — native runtime", () => {
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
    await expect(freighterAdapter.isAvailable()).resolves.toBe(false)
  })

  it("connect rejects with wallet_unavailable", async () => {
    await expect(freighterAdapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_unavailable",
      message: expect.stringContaining("native app"),
    })
  })
})
