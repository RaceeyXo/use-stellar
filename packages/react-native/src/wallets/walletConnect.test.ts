const mockInit = jest.fn()
const mockOpenURL = jest.fn().mockResolvedValue(undefined)
const mockSession = {
  topic: "session-topic",
  namespaces: {
    stellar: {
      accounts: ["stellar:testnet:GTESTADDRESS"],
      methods: ["stellar_signXDR"],
      events: [],
    },
  },
}
const mockConnect = jest.fn()
const mockRequest = jest.fn()
const mockClient = {
  connect: mockConnect,
  request: mockRequest,
  disconnect: jest.fn(),
  session: { values: [] as (typeof mockSession)[], get: () => mockSession },
  on: jest.fn(),
  removeListener: jest.fn(),
}

jest.mock("@walletconnect/react-native-compat", () => ({}), { virtual: true })
jest.mock(
  "@walletconnect/sign-client",
  () => ({ SignClient: { init: (...args: unknown[]) => mockInit(...args) } }),
  { virtual: true }
)
jest.mock("react-native", () => ({
  Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
}))

import { getWalletAdapter } from "use-stellar"
import {
  configureReactNativeLobstrAdapter,
  createReactNativeWalletConnectAdapter,
} from "./walletConnect"

const options = {
  projectId: "app-project-id",
  metadata: { name: "Test app", description: "Tests", url: "https://example.test", icons: [] },
}

function clientFor({
  address = "GTESTADDRESS",
  response = { signedXDR: "signed-xdr" },
  connectError,
  requestError,
  paired = false,
}: {
  address?: string
  response?: unknown
  connectError?: Error
  requestError?: Error
  /**
   * Whether the client already holds an approved session. A fresh client does
   * not — and one that does is reused by `connect()` instead of pairing again.
   */
  paired?: boolean
} = {}) {
  mockSession.namespaces.stellar.accounts = [`stellar:testnet:${address}`]
  mockClient.session.values = paired ? [mockSession] : []
  mockConnect.mockImplementation(
    async (params: { requiredNamespaces: { stellar: { chains: string[] } } }) => {
      if (connectError) throw connectError
      mockSession.namespaces.stellar.accounts = [
        `${params.requiredNamespaces.stellar.chains[0]}:${address}`,
      ]
      return {
        uri: "wc:pairing-uri",
        approval: async () => {
          mockClient.session.values = [mockSession]
          return mockSession
        },
      }
    }
  )
  mockRequest.mockImplementation(async () => {
    if (requestError) throw requestError
    return response
  })
  mockInit.mockResolvedValue(mockClient)
  return { client: mockClient, connect: mockConnect, request: mockRequest }
}

describe("React Native WalletConnect adapter", () => {
  beforeEach(() => {
    mockInit.mockReset()
    mockConnect.mockReset()
    mockRequest.mockReset()
    mockOpenURL.mockClear()
  })

  it("pairs and returns the wallet address using the app projectId", async () => {
    clientFor()
    const onPairingUri = jest.fn()
    const adapter = createReactNativeWalletConnectAdapter({ ...options, onPairingUri })

    await expect(adapter.connect("testnet")).resolves.toMatchObject({
      address: "GTESTADDRESS",
      wallet: "walletconnect",
      network: "testnet",
    })
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({ projectId: "app-project-id" }))
    expect(onPairingUri).toHaveBeenCalledWith("wc:pairing-uri")
    expect(mockOpenURL).toHaveBeenCalledWith("wc:pairing-uri")
  })

  it.each([
    ["testnet", "stellar:testnet"],
    ["mainnet", "stellar:pubnet"],
  ] as const)("requests the %s chain (%s)", async (network, chainId) => {
    const { connect } = clientFor()
    const adapter = createReactNativeWalletConnectAdapter(options)
    await adapter.connect(network)
    expect(connect).toHaveBeenCalledWith({
      requiredNamespaces: {
        stellar: { methods: ["stellar_signXDR"], chains: [chainId], events: [] },
      },
    })
  })

  it("signs XDR through stellar_signXDR on the matching chain", async () => {
    const { request } = clientFor({ paired: true })
    const adapter = createReactNativeWalletConnectAdapter(options)
    await expect(
      adapter.signTransaction("unsigned-xdr", {
        address: "GTESTADDRESS",
        network: "testnet",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
    ).resolves.toBe("signed-xdr")
    expect(request).toHaveBeenCalledWith({
      topic: "session-topic",
      chainId: "stellar:testnet",
      request: { method: "stellar_signXDR", params: { xdr: "unsigned-xdr" } },
    })
  })

  it("maps rejected connections and signatures to wallet_access_rejected", async () => {
    clientFor({ connectError: Object.assign(new Error("User rejected request"), { code: 5000 }) })
    const rejectedConnect = createReactNativeWalletConnectAdapter(options)
    await expect(rejectedConnect.connect("testnet")).rejects.toMatchObject({
      code: "wallet_access_rejected",
    })

    clientFor({ paired: true, requestError: new Error("User rejected signing") })
    const rejectedSign = createReactNativeWalletConnectAdapter(options)
    await expect(
      rejectedSign.signTransaction("xdr", {
        address: "GTESTADDRESS",
        network: "testnet",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
    ).rejects.toMatchObject({ code: "wallet_access_rejected" })
  })

  it("rejects custom and unsupported networks without opening a wallet", async () => {
    const adapter = createReactNativeWalletConnectAdapter(options)
    await expect(adapter.connect("custom")).rejects.toMatchObject({
      code: "wallet_network_mismatch",
    })
    await expect(adapter.connect("futurenet")).rejects.toMatchObject({
      code: "wallet_network_mismatch",
    })
    expect(mockInit).not.toHaveBeenCalled()
  })

  it("maps network mismatch, signing failures, and unavailable provider errors", async () => {
    clientFor()
    mockConnect.mockImplementationOnce(async () => ({
      uri: undefined,
      approval: async () => ({
        topic: "topic",
        namespaces: { stellar: { accounts: ["stellar:pubnet:GADDR"] } },
      }),
    }))

    const adapter = createReactNativeWalletConnectAdapter(options)
    await expect(adapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_network_mismatch",
    })

    clientFor({ paired: true, requestError: new Error("relay failed") })
    await expect(
      adapter.signTransaction("xdr", {
        address: "GTESTADDRESS",
        network: "testnet",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
    ).rejects.toMatchObject({ code: "wallet_sign_failed" })

    expect(() => createReactNativeWalletConnectAdapter({ ...options, projectId: " " })).toThrow(
      expect.objectContaining({ code: "wallet_unavailable" })
    )
  })

  it("supports an app-provided universal or deep link opener", async () => {
    clientFor()
    const openWallet = jest.fn()
    const adapter = createReactNativeWalletConnectAdapter({ ...options, openWallet })
    await adapter.connect("testnet")
    expect(openWallet).toHaveBeenCalledWith("wc:pairing-uri")
    expect(mockOpenURL).not.toHaveBeenCalled()
  })

  it("maps an unavailable WalletConnect provider to wallet_unavailable", async () => {
    jest.resetModules()
    mockInit.mockRejectedValueOnce(new Error("provider unavailable"))
    const { createReactNativeWalletConnectAdapter: createAdapter } =
      require("./walletConnect") as typeof import("./walletConnect")
    const adapter = createAdapter(options)
    await expect(adapter.connect("testnet")).rejects.toMatchObject({ code: "wallet_unavailable" })
  })
})

describe("React Native LOBSTR adapter", () => {
  const lobstrOptions = {
    ...options,
    sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  }

  beforeEach(() => {
    mockInit.mockReset()
    mockConnect.mockReset()
    mockOpenURL.mockClear()
  })

  it("opens the LOBSTR app with its WalletConnect deep link and reports lobstr", async () => {
    clientFor()
    const onDisplayUri = jest.fn()
    configureReactNativeLobstrAdapter({ ...lobstrOptions, onDisplayUri })

    await expect(getWalletAdapter("lobstr").connect("testnet")).resolves.toMatchObject({
      address: "GTESTADDRESS",
      wallet: "lobstr",
      network: "testnet",
    })
    expect(onDisplayUri).toHaveBeenCalledWith("wc:pairing-uri")
    expect(mockOpenURL).toHaveBeenCalledWith("lobstr://wc?uri=wc%3Apairing-uri")
  })

  it("uses an app-provided opener instead of Linking", async () => {
    clientFor()
    const openWallet = jest.fn()
    configureReactNativeLobstrAdapter({ ...lobstrOptions, openWallet })

    await getWalletAdapter("lobstr").connect("testnet")

    expect(openWallet).toHaveBeenCalledWith("lobstr://wc?uri=wc%3Apairing-uri")
    expect(mockOpenURL).not.toHaveBeenCalled()
  })

  it("fails with a configuration error that says how to configure a project ID", () => {
    expect(() => configureReactNativeLobstrAdapter({ ...lobstrOptions, projectId: " " })).toThrow(
      expect.objectContaining({
        code: "wallet_unavailable",
        message: expect.stringContaining("configureLobstrAdapter"),
      })
    )
  })
})
