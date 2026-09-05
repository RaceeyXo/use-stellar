import React, { type ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { getNetworkDetails, isAllowed, isConnected, requestAccess } from "@stellar/freighter-api"
import { StellarProvider, WALLET_SESSION_STORAGE_KEY } from "../context/StellarProvider"
import { NETWORK_PASSPHRASES, registerWalletAdapter } from "../wallets"
import { getNetworkPassphrase } from "../types"
import { useWallet } from "./useWallet"
import * as freighterApi from "@stellar/freighter-api"

/** Testnet-only address used throughout this file. */
const TEST_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

interface WatchParams {
  address: string
  network: string
  networkPassphrase: string
  error?: { message: string }
}

// Handlers registered by the fake WatchWalletChanges, so a test can push a
// wallet-side change the way the extension would.
const watchers: {
  handler: ((params: WatchParams) => void) | null
  stopped: boolean
}[] = []

jest.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: jest.fn(),
  isAllowed: jest.fn(),
  isConnected: jest.fn(),
  requestAccess: jest.fn(),
  signTransaction: jest.fn(),
  WatchWalletChanges: class {
    private entry: { handler: ((params: WatchParams) => void) | null; stopped: boolean }

    constructor() {
      this.entry = { handler: null, stopped: false }
      watchers.push(this.entry)
    }

    watch(cb: (params: WatchParams) => void) {
      this.entry.handler = cb
      return {}
    }

    stop() {
      this.entry.stopped = true
    }
  },
}))

/** Pushes a change through every live watcher, as the extension would. */
function emitWalletChange(params: WatchParams) {
  watchers.forEach(entry => {
    if (!entry.stopped) entry.handler?.(params)
  })
}

const mockIsConnected = jest.mocked(isConnected)
const mockRequestAccess = jest.mocked(requestAccess)
const mockGetNetworkDetails = jest.mocked(getNetworkDetails)
const mockIsAllowed = jest.mocked(isAllowed)
const mockedFreighter = freighterApi as jest.Mocked<typeof freighterApi>

/** Puts Freighter in a state where connect() succeeds on testnet. */
function mockConnectedFreighter(passphrase: string = NETWORK_PASSPHRASES.testnet) {
  mockedFreighter.isConnected.mockResolvedValue({ isConnected: true, error: undefined })
  mockedFreighter.requestAccess.mockResolvedValue({ address: TEST_ADDRESS, error: undefined })
  mockedFreighter.getNetworkDetails.mockResolvedValue({
    networkPassphrase: passphrase,
    error: undefined,
    network: "TESTNET",
    networkUrl: "",
  })
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <StellarProvider>{children}</StellarProvider>
)

function createWrapper(network: "testnet" | "mainnet" = "testnet") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <StellarProvider network={network}>{children}</StellarProvider>
  }
}

describe("useWallet", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    watchers.length = 0
    window.localStorage.clear()
  })

  describe("connect", () => {
    it("keeps connect freighter backward compatible", async () => {
      mockIsConnected.mockResolvedValue({ isConnected: true })
      mockRequestAccess.mockResolvedValue({ address: "GABC" })
      mockGetNetworkDetails.mockResolvedValue({
        network: "TESTNET",
        networkUrl: "https://horizon-testnet.stellar.org",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })

      const { result } = renderHook(() => useWallet(), { wrapper })

      await act(async () => {
        await result.current.connect("freighter")
      })

      expect(result.current.connected).toBe(true)
      expect(result.current.address).toBe("GABC")
      expect(result.current.wallet).toBe("freighter")
      expect(result.current.walletName).toBe("Freighter")
      expect(result.current.error).toBeNull()
    })

    it("sets a typed unsupported-wallet message without breaking state", async () => {
      const { result } = renderHook(() => useWallet(), { wrapper })

      await act(async () => {
        await result.current.connect("rabet")
      })

      expect(result.current.connected).toBe(false)
      expect(result.current.wallet).toBeNull()
      expect(result.current.error?.message).toBe("Rabet is not supported yet.")
    })

    it("should capture wallet network on successful connection", async () => {
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        error: undefined,
        network: "testnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      expect(result.current.connected).toBe(true)
      expect(result.current.walletNetwork).toBe("testnet")
      expect(result.current.isNetworkMismatch).toBe(false)
    })

    it("should detect network mismatch on connection", async () => {
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      // Wallet is on mainnet but provider expects testnet
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        error: undefined,
        network: "mainnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      expect(result.current.connected).toBe(true)
      expect(result.current.walletNetwork).toBe("mainnet")
      expect(result.current.isNetworkMismatch).toBe(true)
    })
  })

  describe("disconnect", () => {
    it("should clear wallet network state", async () => {
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        error: undefined,
        network: "testnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      expect(result.current.walletNetwork).toBe("testnet")

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.connected).toBe(false)
      expect(result.current.walletNetwork).toBe(null)
      expect(result.current.isNetworkMismatch).toBe(false)
    })
  })

  describe("refreshWalletNetwork", () => {
    it("should update wallet network state", async () => {
      // Initial connection
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        error: undefined,
        network: "testnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      expect(result.current.walletNetwork).toBe("testnet")

      // Simulate wallet network change
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        error: undefined,
        network: "mainnet",
        networkUrl: "",
      })

      await act(async () => {
        await result.current.refreshWalletNetwork()
      })

      expect(result.current.walletNetwork).toBe("mainnet")
    })

    it("should do nothing if wallet is not connected", async () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.refreshWalletNetwork()
      })

      expect(mockedFreighter.getNetworkDetails).not.toHaveBeenCalled()
    })

    it("reports an unrecognised passphrase as a custom network instead of throwing", async () => {
      // Initial connection
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        error: undefined,
        network: "testnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      // The user points Freighter at a private network.
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Standalone Network ; February 2017",
        error: undefined,
        network: "STANDALONE",
        networkUrl: "",
      })

      await act(async () => {
        await result.current.refreshWalletNetwork()
      })

      // A network we do not recognise is a value, not a failure. core-03 adds
      // custom-passphrase support and a throw here would defeat it.
      expect(result.current.error).toBeNull()
      expect(result.current.walletNetwork).toBe("custom")
      expect(result.current.walletNetworkPassphrase).toBe("Standalone Network ; February 2017")
      expect(result.current.isNetworkMismatch).toBe(true)
    })

    it("refreshes a non-Freighter wallet through its adapter", async () => {
      const getNetworkDetails = jest
        .fn()
        .mockResolvedValueOnce({
          network: "testnet",
          networkPassphrase: NETWORK_PASSPHRASES.testnet,
        })
        .mockResolvedValueOnce({
          network: "mainnet",
          networkPassphrase: NETWORK_PASSPHRASES.mainnet,
        })

      registerWalletAdapter(
        {
          metadata: { type: "refreshable", name: "Refreshable", supported: true },
          isAvailable: async () => true,
          connect: async network => ({
            address: TEST_ADDRESS,
            wallet: "refreshable",
            network,
            networkPassphrase: getNetworkPassphrase(network) ?? "",
          }),
          getNetworkDetails,
          signTransaction: async () => "signed",
        },
        { override: true }
      )

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("refreshable")
      })

      await act(async () => {
        await result.current.refreshWalletNetwork()
      })

      // No `wallet.wallet === "freighter"` branch stands between a
      // non-Freighter wallet and a network refresh.
      expect(getNetworkDetails).toHaveBeenCalledTimes(2)
      expect(result.current.walletNetwork).toBe("mainnet")
    })
  })

  describe("isNetworkMismatch", () => {
    it("should return false when networks match", async () => {
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        error: undefined,
        network: "testnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      expect(result.current.isNetworkMismatch).toBe(false)
    })

    it("should return true when networks mismatch after refresh", async () => {
      mockedFreighter.isConnected.mockResolvedValue({
        isConnected: true,
        error: undefined,
      })
      mockedFreighter.requestAccess.mockResolvedValue({
        address: "GABC123",
        error: undefined,
      })
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Test SDF Network ; September 2015",
        error: undefined,
        network: "testnet",
        networkUrl: "",
      })

      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      await act(async () => {
        await result.current.connect("freighter")
      })

      // User switches network in wallet
      mockedFreighter.getNetworkDetails.mockResolvedValue({
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        error: undefined,
        network: "mainnet",
        networkUrl: "",
      })

      await act(async () => {
        await result.current.refreshWalletNetwork()
      })

      expect(result.current.isNetworkMismatch).toBe(true)
    })

    it("should return false when not connected", () => {
      const { result } = renderHook(() => useWallet(), {
        wrapper: createWrapper("testnet"),
      })

      expect(result.current.isNetworkMismatch).toBe(false)
    })
  })
})

// ── Part 1: session restore ────────────────────────────────────────────────
function autoConnectWrapper(
  autoConnect: boolean | { enabled?: boolean; persistAddress?: boolean } = true
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StellarProvider network="testnet" autoConnect={autoConnect}>
        {children}
      </StellarProvider>
    )
  }
}

function seedSession(session: unknown) {
  window.localStorage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(session))
}

describe("useWallet — session restore", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    watchers.length = 0
    window.localStorage.clear()
  })

  it("is off by default — a stored session is ignored without the opt-in", async () => {
    seedSession({ wallet: "freighter" })
    mockConnectedFreighter()
    mockIsAllowed.mockResolvedValue({ isAllowed: true, error: undefined })

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper("testnet") })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.connected).toBe(false)
    expect(mockRequestAccess).not.toHaveBeenCalled()
  })

  it("reconnects without a prompt when the wallet is already approved", async () => {
    seedSession({ wallet: "freighter" })
    mockConnectedFreighter()
    mockIsAllowed.mockResolvedValue({ isAllowed: true, error: undefined })

    const { result } = renderHook(() => useWallet(), { wrapper: autoConnectWrapper() })

    await waitFor(() => expect(result.current.connected).toBe(true))

    expect(result.current.address).toBe(TEST_ADDRESS)
    expect(result.current.walletNetwork).toBe("testnet")
  })

  it("restores intent only when reconnecting would raise a prompt", async () => {
    seedSession({ wallet: "freighter", address: TEST_ADDRESS })
    mockConnectedFreighter()
    // The origin has not been approved — connect() would pop a dialog.
    mockIsAllowed.mockResolvedValue({ isAllowed: false, error: undefined })

    const { result } = renderHook(() => useWallet(), {
      wrapper: autoConnectWrapper({ enabled: true, persistAddress: true }),
    })

    await waitFor(() => expect(result.current.wallet).toBe("freighter"))

    expect(result.current.connected).toBe(false)
    expect(result.current.address).toBe(TEST_ADDRESS)
    expect(mockRequestAccess).not.toHaveBeenCalled()
  })

  it("persists the wallet type on connect, and clears it on disconnect", async () => {
    mockConnectedFreighter()

    const { result } = renderHook(() => useWallet(), { wrapper: autoConnectWrapper() })

    await act(async () => {
      await result.current.connect("freighter")
    })

    expect(window.localStorage.getItem(WALLET_SESSION_STORAGE_KEY)).toContain("freighter")
    // The address is not persisted unless persistAddress is on, and nothing
    // secret is ever persisted.
    expect(window.localStorage.getItem(WALLET_SESSION_STORAGE_KEY)).not.toContain(TEST_ADDRESS)

    act(() => {
      result.current.disconnect()
    })

    expect(window.localStorage.getItem(WALLET_SESSION_STORAGE_KEY)).toBeNull()
  })

  it("survives a localStorage read that throws", async () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("The operation is insecure.")
    })

    try {
      const { result } = renderHook(() => useWallet(), { wrapper: autoConnectWrapper() })

      await act(async () => {
        await Promise.resolve()
      })

      // Mount completes, the hook is usable, nothing is thrown.
      expect(result.current.connected).toBe(false)
      expect(result.current.error).toBeNull()
    } finally {
      getItem.mockRestore()
    }
  })

  it("discards a corrupted stored value", async () => {
    window.localStorage.setItem(WALLET_SESSION_STORAGE_KEY, "{not json")

    const { result } = renderHook(() => useWallet(), { wrapper: autoConnectWrapper() })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.connected).toBe(false)
    expect(result.current.wallet).toBeNull()
    expect(mockIsConnected).not.toHaveBeenCalled()
  })

  it("discards an unknown stored wallet type rather than passing it to the registry", async () => {
    seedSession({ wallet: "nonsense" })

    const { result } = renderHook(() => useWallet(), { wrapper: autoConnectWrapper() })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.connected).toBe(false)
    expect(result.current.wallet).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

// ── Part 2: wallet change events ───────────────────────────────────────────
describe("useWallet — wallet change events", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    watchers.length = 0
    window.localStorage.clear()
  })

  it("updates the address when the user switches account in the extension", async () => {
    mockConnectedFreighter()
    const SECOND_ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper("testnet") })

    await act(async () => {
      await result.current.connect("freighter")
    })

    act(() => {
      emitWalletChange({
        address: SECOND_ADDRESS,
        network: "TESTNET",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    })

    await waitFor(() => expect(result.current.address).toBe(SECOND_ADDRESS))
    expect(result.current.isNetworkMismatch).toBe(false)
  })

  it("flags a mismatch when the user switches network in the extension", async () => {
    mockConnectedFreighter()

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper("testnet") })

    await act(async () => {
      await result.current.connect("freighter")
    })

    expect(result.current.isNetworkMismatch).toBe(false)

    act(() => {
      emitWalletChange({
        address: TEST_ADDRESS,
        network: "PUBLIC",
        networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      })
    })

    await waitFor(() => expect(result.current.walletNetwork).toBe("mainnet"))
    expect(result.current.isNetworkMismatch).toBe(true)
  })

  it("tears the subscription down on unmount, and runs no setWallet afterwards", async () => {
    mockConnectedFreighter()
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: createWrapper("testnet"),
    })

    await act(async () => {
      await result.current.connect("freighter")
    })

    expect(watchers.some(entry => entry.handler)).toBe(true)

    const addressBeforeUnmount = result.current.address
    unmount()

    expect(watchers.every(entry => entry.stopped)).toBe(true)

    // Even if a late tick slips through, nothing updates state after unmount.
    act(() => {
      emitWalletChange({
        address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        network: "TESTNET",
        networkPassphrase: NETWORK_PASSPHRASES.testnet,
      })
    })

    expect(result.current.address).toBe(addressBeforeUnmount)
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("tears the subscription down on disconnect", async () => {
    mockConnectedFreighter()

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper("testnet") })

    await act(async () => {
      await result.current.connect("freighter")
    })

    act(() => {
      result.current.disconnect()
    })

    await waitFor(() => expect(watchers.every(entry => entry.stopped)).toBe(true))
  })
})

// ── Part 3: custom adapters ────────────────────────────────────────────────
describe("useWallet — custom adapters", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    watchers.length = 0
    window.localStorage.clear()
  })

  it("connects through an adapter registered from outside the package", async () => {
    registerWalletAdapter(
      {
        metadata: { type: "outside-wallet", name: "Outside Wallet", supported: true },
        isAvailable: async () => true,
        connect: async network => ({
          address: TEST_ADDRESS,
          wallet: "outside-wallet",
          network,
          networkPassphrase: getNetworkPassphrase(network) ?? "",
        }),
        getNetworkDetails: async network => ({
          network,
          networkPassphrase: getNetworkPassphrase(network) ?? "",
        }),
        signTransaction: async () => "signed",
      },
      { override: true }
    )

    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper("testnet") })

    await act(async () => {
      await result.current.connect("outside-wallet")
    })

    expect(result.current.connected).toBe(true)
    expect(result.current.wallet).toBe("outside-wallet")
    expect(result.current.walletName).toBe("Outside Wallet")
    expect(result.current.address).toBe(TEST_ADDRESS)
  })

  it("surfaces a typed error for a wallet nobody registered", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: createWrapper("testnet") })

    await act(async () => {
      await result.current.connect("nonsense")
    })

    expect(result.current.connected).toBe(false)
    expect(result.current.error?.message).toContain('Unknown wallet type "nonsense"')
  })
})
