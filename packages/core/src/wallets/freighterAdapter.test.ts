import {
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api"
import { NETWORK_PASSPHRASES, freighterAdapter } from "./freighterAdapter"

jest.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: jest.fn(),
  isConnected: jest.fn(),
  requestAccess: jest.fn(),
  signTransaction: jest.fn(),
}))

const mockIsConnected = jest.mocked(isConnected)
const mockRequestAccess = jest.mocked(requestAccess)
const mockGetNetworkDetails = jest.mocked(getNetworkDetails)
const mockSignTransaction = jest.mocked(signTransaction)

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
