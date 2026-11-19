import type { WalletAdapter } from "./types"

const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS"
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"

const mockInit = jest.fn()

jest.mock("@walletconnect/sign-client", () => ({ SignClient: { init: mockInit } }), {
  virtual: true,
})

function session(topic: string, ...accounts: string[]) {
  return { topic, namespaces: { stellar: { accounts, methods: [], events: [] } } }
}

function createClient(sessions: ReturnType<typeof session>[] = []) {
  const listeners: Record<string, ((args: unknown) => void)[]> = {}
  return {
    session: { values: sessions, get: jest.fn() },
    connect: jest.fn(),
    request: jest.fn().mockResolvedValue({ signedXDR: "signed" }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event: string, listener: (args: unknown) => void) => {
      ;(listeners[event] ??= []).push(listener)
    }),
    removeListener: jest.fn(),
    emit: (event: string, args: unknown = {}) => listeners[event]?.forEach(l => l(args)),
  }
}

/** The adapter caches its SignClient at module scope, so each test loads a fresh module. */
function loadAdapter(options: { onDisplayUri?: (uri: string) => void } = {}): WalletAdapter {
  let adapter!: WalletAdapter
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createWalletConnectAdapter } = require("./walletConnectAdapter")
    adapter = createWalletConnectAdapter({
      projectId: "test",
      metadata: { name: "Test", description: "Test App", url: "https://test.com", icons: [] },
      ...options,
    })
  })
  return adapter
}

beforeEach(() => {
  mockInit.mockReset()
})

describe("walletConnectAdapter sessions", () => {
  it("reuses an approved session instead of starting a new pairing", async () => {
    const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
    mockInit.mockResolvedValue(client)
    const adapter = loadAdapter()

    expect(await adapter.canAutoConnect?.()).toBe(true)
    const connection = await adapter.connect("testnet")

    expect(connection.address).toBe(ADDR_A)
    expect(client.connect).not.toHaveBeenCalled()
  })

  it("pairs when no session covers the requested network", async () => {
    const client = createClient([session("t1", `stellar:pubnet:${ADDR_A}`)])
    client.connect.mockResolvedValue({
      uri: "wc:uri",
      approval: async () => session("t2", `stellar:testnet:${ADDR_B}`),
    })
    mockInit.mockResolvedValue(client)
    const onDisplayUri = jest.fn()
    const adapter = loadAdapter({ onDisplayUri })

    const connection = await adapter.connect("testnet")

    expect(onDisplayUri).toHaveBeenCalledWith("wc:uri")
    expect(connection.address).toBe(ADDR_B)
  })

  it("signs with the session that approved the account, not the newest one", async () => {
    const client = createClient([
      session("mine", `stellar:testnet:${ADDR_A}`),
      session("other", `stellar:testnet:${ADDR_B}`),
    ])
    mockInit.mockResolvedValue(client)
    const adapter = loadAdapter()

    const signed = await adapter.signTransaction("xdr", {
      address: ADDR_A,
      network: "testnet",
      networkPassphrase: TESTNET_PASSPHRASE,
    })

    expect(signed).toBe("signed")
    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mine", chainId: "stellar:testnet" })
    )
  })

  it("refuses to sign for an account no session approved", async () => {
    const client = createClient([session("other", `stellar:testnet:${ADDR_B}`)])
    mockInit.mockResolvedValue(client)
    const adapter = loadAdapter()

    await expect(
      adapter.signTransaction("xdr", {
        address: ADDR_A,
        network: "testnet",
        networkPassphrase: TESTNET_PASSPHRASE,
      })
    ).rejects.toMatchObject({ code: "wallet_network_mismatch" })
    expect(client.request).not.toHaveBeenCalled()
  })

  it("closes its sessions on disconnect", async () => {
    const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
    mockInit.mockResolvedValue(client)
    const adapter = loadAdapter()
    await adapter.connect("testnet")

    await adapter.disconnect?.()

    expect(client.disconnect).toHaveBeenCalledWith(expect.objectContaining({ topic: "t1" }))
  })

  it("does not load the SDK just to disconnect", async () => {
    const adapter = loadAdapter()

    await adapter.disconnect?.()

    expect(mockInit).not.toHaveBeenCalled()
  })

  it("retries initialisation after a failed attempt", async () => {
    const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
    mockInit.mockRejectedValueOnce(new Error("relay unreachable")).mockResolvedValue(client)
    const adapter = loadAdapter()

    await expect(adapter.connect("testnet")).rejects.toMatchObject({ code: "wallet_unavailable" })
    await expect(adapter.connect("testnet")).resolves.toMatchObject({ address: ADDR_A })
  })

  it("reports a wallet-side session delete as a disconnection", async () => {
    const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
    mockInit.mockResolvedValue(client)
    const adapter = loadAdapter()
    const handler = jest.fn()

    adapter.subscribe?.(handler)
    await new Promise(resolve => setTimeout(resolve, 0))
    client.emit("session_delete")
    // The stored session is cleared before the handler is told.
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ disconnected: true }))
  })
})
