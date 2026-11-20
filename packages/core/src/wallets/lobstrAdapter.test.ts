import type { SessionStorageAdapter } from "../types"
import { readWalletSession, WALLET_SESSION_STORAGE_KEY } from "../runtime/walletSession"
import {
  LOBSTR_DEEP_LINK_BASE,
  configureLobstrAdapter,
  createLobstrAdapter,
  getLobstrDeepLink,
  lobstrAdapter,
  resetLobstrAdapter,
} from "./lobstrAdapter"
import { getWalletAdapter } from "./registry"
import { WalletAdapterError } from "./types"

const ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"

const mockInit = jest.fn()

jest.mock("@walletconnect/sign-client", () => ({ SignClient: { init: mockInit } }), {
  virtual: true,
})

// The WalletConnect adapter keeps one SignClient for the process, so every test
// shares this client and only changes the sessions it holds.
const client = {
  session: { values: [] as unknown[], get: jest.fn() },
  connect: jest.fn(),
  request: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  removeListener: jest.fn(),
}
mockInit.mockResolvedValue(client)

function pairingSession(address = ADDRESS) {
  return {
    topic: "topic-1",
    namespaces: {
      stellar: { accounts: [`stellar:testnet:${address}`], methods: [], events: [] },
    },
  }
}

function approveOnConnect(uri = "wc:pairing-uri@2") {
  client.connect.mockImplementation(async () => ({
    uri,
    approval: async () => {
      const session = pairingSession()
      client.session.values = [session]
      return session
    },
  }))
}

function memoryStorage(): SessionStorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: key => void data.delete(key),
  }
}

const metadata = {
  name: "Test app",
  description: "Tests",
  url: "https://example.test",
  icons: [],
}

describe("lobstrAdapter", () => {
  beforeEach(() => {
    resetLobstrAdapter()
    client.session.values = []
    client.connect.mockReset()
    client.request.mockReset()
  })

  describe("without a project ID", () => {
    it("is registered as a supported LOBSTR adapter, not the placeholder", () => {
      const adapter = getWalletAdapter("lobstr")
      expect(adapter).toBe(lobstrAdapter)
      expect(adapter.metadata).toEqual({
        type: "lobstr",
        name: "LOBSTR",
        supported: true,
        platforms: ["web", "native"],
      })
    })

    it("connect fails with a configuration error that says how to configure", async () => {
      const error = await lobstrAdapter.connect("testnet").catch(e => e)
      expect(error).toBeInstanceOf(WalletAdapterError)
      expect(error.code).toBe("wallet_unavailable")
      expect(error.code).not.toBe("wallet_unsupported")
      expect(error.message).toMatch(/project ID/)
      expect(error.message).toMatch(/configureLobstrAdapter/)
    })

    it("signTransaction fails with the same configuration error", async () => {
      await expect(
        lobstrAdapter.signTransaction("xdr", {
          address: ADDRESS,
          network: "testnet",
          networkPassphrase: TESTNET_PASSPHRASE,
        })
      ).rejects.toMatchObject({
        code: "wallet_unavailable",
        message: expect.stringMatching(/project ID/),
      })
    })

    it("reports itself unavailable and cannot silently reconnect", async () => {
      await expect(lobstrAdapter.isAvailable()).resolves.toBe(false)
      await expect(lobstrAdapter.canAutoConnect?.("testnet")).resolves.toBe(false)
    })

    it.each(["", "   "])("configureLobstrAdapter rejects a blank project ID (%j)", projectId => {
      expect(() => configureLobstrAdapter({ projectId })).toThrow(/project ID/)
    })
  })

  describe("with a project ID", () => {
    it("connects through WalletConnect and reports the lobstr wallet", async () => {
      approveOnConnect()
      configureLobstrAdapter({
        projectId: "test-project-id",
        metadata,
        sessionStorage: memoryStorage(),
      })

      await expect(getWalletAdapter("lobstr").connect("testnet")).resolves.toEqual({
        address: ADDRESS,
        wallet: "lobstr",
        network: "testnet",
        networkPassphrase: TESTNET_PASSPHRASE,
      })
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "test-project-id", metadata })
      )
      await expect(lobstrAdapter.isAvailable()).resolves.toBe(true)
    })

    it("hands the pairing URI to onDisplayUri and the deep link to openWallet", async () => {
      approveOnConnect("wc:abc@2?relay=irn&symKey=k")
      const onDisplayUri = jest.fn()
      const openWallet = jest.fn()
      const adapter = createLobstrAdapter({
        projectId: "test-project-id",
        metadata,
        sessionStorage: memoryStorage(),
        onDisplayUri,
        openWallet,
      })

      await adapter.connect("testnet")

      expect(onDisplayUri).toHaveBeenCalledWith("wc:abc@2?relay=irn&symKey=k")
      expect(openWallet).toHaveBeenCalledWith(
        `${LOBSTR_DEEP_LINK_BASE}?uri=${encodeURIComponent("wc:abc@2?relay=irn&symKey=k")}`
      )
    })

    it("still connects when the wallet cannot be opened (LOBSTR not installed)", async () => {
      approveOnConnect()
      const adapter = createLobstrAdapter({
        projectId: "test-project-id",
        metadata,
        sessionStorage: memoryStorage(),
        openWallet: () => Promise.reject(new Error("no handler")),
      })

      await expect(adapter.connect("testnet")).resolves.toMatchObject({ wallet: "lobstr" })
    })

    it("persists the session as lobstr so it can be restored", async () => {
      approveOnConnect()
      const storage = memoryStorage()
      configureLobstrAdapter({ projectId: "test-project-id", metadata, sessionStorage: storage })

      await lobstrAdapter.connect("testnet")

      expect(JSON.parse(storage.data.get(WALLET_SESSION_STORAGE_KEY) as string)).toEqual({
        wallet: "lobstr",
        address: ADDRESS,
        chain: "stellar:testnet",
      })
      await expect(readWalletSession(storage)).resolves.toMatchObject({ wallet: "lobstr" })
    })

    it("signs through the WalletConnect session", async () => {
      client.session.values = [pairingSession()]
      client.request.mockResolvedValue({ signedXDR: "signed-xdr" })
      configureLobstrAdapter({
        projectId: "test-project-id",
        metadata,
        sessionStorage: memoryStorage(),
      })

      await expect(
        lobstrAdapter.signTransaction("unsigned-xdr", {
          address: ADDRESS,
          network: "testnet",
          networkPassphrase: TESTNET_PASSPHRASE,
        })
      ).resolves.toBe("signed-xdr")
      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: "stellar:testnet" })
      )
    })

    it("maps a rejection in the wallet to wallet_access_rejected", async () => {
      client.connect.mockRejectedValue(Object.assign(new Error("User rejected"), { code: 5000 }))
      configureLobstrAdapter({
        projectId: "test-project-id",
        metadata,
        sessionStorage: memoryStorage(),
      })

      await expect(lobstrAdapter.connect("testnet")).rejects.toMatchObject({
        code: "wallet_access_rejected",
      })
    })
  })

  describe("getLobstrDeepLink", () => {
    it("URL-encodes the pairing URI", () => {
      expect(getLobstrDeepLink("wc:a@2?x=1&y=2")).toBe("lobstr://wc?uri=wc%3Aa%402%3Fx%3D1%26y%3D2")
    })
  })
})
