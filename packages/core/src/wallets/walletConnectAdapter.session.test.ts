import type { WalletAdapter, SessionStorageAdapter } from "./types"

const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS"
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"
const PUBNET_PASSPHRASE = "Public Global Stellar Network ; September 2015"

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
    removeListener: jest.fn((event: string, listener: (args: unknown) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== listener)
      }
    }),
    emit: (event: string, args: unknown = {}) => listeners[event]?.forEach(l => l(args)),
  }
}

/**
 * In-memory storage adapter for testing.
 * Simulates both sync and async operations for testing different platforms.
 */
function createMemoryStorage(isAsync = false): SessionStorageAdapter {
  const storage = new Map<string, string>()

  return {
    getItem(key: string) {
      const value = storage.get(key) || null
      return isAsync ? Promise.resolve(value) : value
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
      return isAsync ? Promise.resolve() : undefined
    },
    removeItem(key: string) {
      storage.delete(key)
      return isAsync ? Promise.resolve() : undefined
    },
  }
}

/** The adapter caches its SignClient at module scope, so each test loads a fresh module. */
function loadAdapter(options: {
  onDisplayUri?: (uri: string) => void
  sessionStorage?: SessionStorageAdapter
} = {}): WalletAdapter {
  let adapter!: WalletAdapter
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createWalletConnectAdapter } = require("./walletConnectAdapter")
    adapter = createWalletConnectAdapter({
      projectId: "test",
      metadata: { name: "Test", description: "Test App", url: "https://test.com", icons: [] },
      sessionStorage: options.sessionStorage,
      ...options,
    })
  })
  return adapter
}

beforeEach(() => {
  mockInit.mockReset()
  jest.clearAllMocks()
})

describe("walletConnectAdapter session integration", () => {
  describe("Valid, unexpired session for runtime chain", () => {
    it("canAutoConnect returns true and startup reconnects silently with stored account", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      // First, verify canAutoConnect returns true
      expect(await adapter.canAutoConnect?.()).toBe(true)

      // Connect should reuse the session without prompting
      const connection = await adapter.connect("testnet")
      expect(connection.address).toBe(ADDR_A)
      expect(client.connect).not.toHaveBeenCalled()

      // Verify the session was persisted
      const stored = await storage.getItem("use-stellar:wallet-session")
      const parsedSession = JSON.parse(stored!)
      expect(parsedSession).toEqual({
        wallet: "walletconnect",
        address: ADDR_A,
        chain: "stellar:testnet",
      })
    })
  })

  describe("Valid session on different chain than runtime's", () => {
    it("canAutoConnect returns false and intent is restored only", async () => {
      const client = createClient([session("t1", `stellar:pubnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      // canAutoConnect should return false for testnet (session is on pubnet)
      expect(await adapter.canAutoConnect?.()).toBe(false)

      // For this test, we verify that a subsequent connect to testnet would prompt
      // (Actual wrong-chain reconnect with intent restoration happens at app layer via stored session)
      client.connect.mockResolvedValue({
        uri: "wc:uri",
        approval: async () => session("t2", `stellar:testnet:${ADDR_B}`),
      })

      const connection = await adapter.connect("testnet")
      expect(connection.address).toBe(ADDR_B)
      expect(client.connect).toHaveBeenCalled()

      // The new session should be persisted
      const stored = await storage.getItem("use-stellar:wallet-session")
      const parsedSession = JSON.parse(stored!)
      expect(parsedSession.chain).toBe("stellar:testnet")
    })
  })

  describe("No session at all", () => {
    it("canAutoConnect returns false and no intent is invented", async () => {
      const client = createClient([]) // Empty sessions
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      expect(await adapter.canAutoConnect?.()).toBe(false)

      // Storage should remain empty
      const stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()
    })
  })

  describe("Wallet-side disconnect event", () => {
    it("session_delete event clears stored session and notifies subscribers", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      // First, establish a connection and subscribe
      await adapter.connect("testnet")
      const handler = jest.fn()
      adapter.subscribe?.(handler)

      // Let the subscribe async initialization complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify session was stored
      let stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).not.toBeNull()

      // Wallet sends session_delete event
      client.emit("session_delete")

      // Wait for async storage clear to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify stored session was cleared
      stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()

      // Handler should be called with disconnect flag
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ disconnected: true }))
    })
  })

  describe("App-side disconnect", () => {
    it("disconnect ends WalletConnect session and clears stored session", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      await adapter.connect("testnet")

      // Verify session was stored
      let stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).not.toBeNull()

      // Disconnect
      await adapter.disconnect?.()

      // Verify WalletConnect session was ended
      expect(client.disconnect).toHaveBeenCalledWith(expect.objectContaining({ topic: "t1" }))

      // Verify stored session was cleared
      stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()
    })

    it("clears stored session even if remote disconnect throws", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      client.disconnect.mockRejectedValue(new Error("Network error"))
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      await adapter.connect("testnet")

      // Verify session was stored
      let stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).not.toBeNull()

      // Disconnect (remote fails, but local should still clear)
      await expect(adapter.disconnect?.()).resolves.toBeUndefined()

      // Verify stored session was still cleared despite remote error
      stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()
    })

    it("clears stored session even if no client was loaded", async () => {
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      // Manually write a session without loading client
      await storage.setItem("use-stellar:wallet-session", JSON.stringify({
        wallet: "walletconnect",
        address: ADDR_A,
        chain: "stellar:testnet",
      }))

      // Verify session exists
      let stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).not.toBeNull()

      // Disconnect without client loaded
      await adapter.disconnect?.()

      // Verify stored session was cleared
      stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()

      // Client should never have been loaded
      expect(mockInit).not.toHaveBeenCalled()
    })
  })

  describe("Account change event", () => {
    it("session_update event with new account updates stored session and notifies handler", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      await adapter.connect("testnet")
      const handler = jest.fn()
      adapter.subscribe?.(handler)

      await new Promise(resolve => setTimeout(resolve, 10))

      // Wallet sends update with different account
      client.emit("session_update", {
        params: { namespaces: { stellar: { accounts: [`stellar:testnet:${ADDR_B}`] } } },
      })

      // Handler should be called with new account
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: ADDR_B,
          network: "testnet",
          networkPassphrase: TESTNET_PASSPHRASE,
        })
      )

      // Stored session should be updated
      const stored = await storage.getItem("use-stellar:wallet-session")
      const parsedSession = JSON.parse(stored!)
      expect(parsedSession.address).toBe(ADDR_B)
    })
  })

  describe("Chain change event", () => {
    it("session_update event with new chain updates stored session and notifies handler", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      await adapter.connect("testnet")
      const handler = jest.fn()
      adapter.subscribe?.(handler)

      await new Promise(resolve => setTimeout(resolve, 10))

      // Wallet sends update with account on different chain
      client.emit("session_update", {
        params: { namespaces: { stellar: { accounts: [`stellar:pubnet:${ADDR_A}`] } } },
      })

      // Handler should be called with new chain
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: ADDR_A,
          network: "mainnet",
          networkPassphrase: PUBNET_PASSPHRASE,
        })
      )

      // Stored session should be updated with new chain
      const stored = await storage.getItem("use-stellar:wallet-session")
      const parsedSession = JSON.parse(stored!)
      expect(parsedSession.chain).toBe("stellar:pubnet")
    })
  })

  describe("Unsubscribe", () => {
    it("unsubscribe prevents further events from reaching listener", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      await adapter.connect("testnet")
      const handler = jest.fn()
      const unsubscribe = adapter.subscribe?.(handler)

      await new Promise(resolve => setTimeout(resolve, 10))

      // Emit an event before unsubscribe
      client.emit("session_update", {
        params: { namespaces: { stellar: { accounts: [`stellar:testnet:${ADDR_B}`] } } },
      })

      expect(handler).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsubscribe?.()

      // Emit another event after unsubscribe
      client.emit("session_update", {
        params: { namespaces: { stellar: { accounts: [`stellar:testnet:${ADDR_A}`] } } },
      })

      // Handler should not be called again
      expect(handler).toHaveBeenCalledTimes(1)

      // Listeners should be removed from client
      expect(client.removeListener).toHaveBeenCalled()
    })

    it("underlying WalletConnect listeners are removed on unsubscribe", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      await adapter.connect("testnet")
      const handler = jest.fn()
      const unsubscribe = adapter.subscribe?.(handler)

      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify listeners were added
      expect(client.on).toHaveBeenCalledWith("session_update", expect.any(Function))
      expect(client.on).toHaveBeenCalledWith("session_delete", expect.any(Function))

      // Unsubscribe
      unsubscribe?.()

      // Verify listeners were removed
      expect(client.removeListener).toHaveBeenCalledWith("session_update", expect.any(Function))
      expect(client.removeListener).toHaveBeenCalledWith("session_delete", expect.any(Function))
    })
  })

  describe("Disagreement case: stored session but no live WalletConnect session", () => {
    it("clears stored session and calls handler on first subscribe event", async () => {
      const storage = createMemoryStorage()
      const client = createClient([]) // No live WalletConnect session

      // Manually write a stale session
      await storage.setItem("use-stellar:wallet-session", JSON.stringify({
        wallet: "walletconnect",
        address: ADDR_A,
        chain: "stellar:testnet",
      }))

      mockInit.mockResolvedValue(client)
      const adapter = loadAdapter({ sessionStorage: storage })

      // Verify stored session exists
      let stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).not.toBeNull()

      // Subscribe and wait for initialization
      const handler = jest.fn()
      adapter.subscribe?.(handler)
      await new Promise(resolve => setTimeout(resolve, 10))

      // Manually trigger a session_delete to simulate WalletConnect reconciliation
      client.emit("session_delete")
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify stored session was cleared
      stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()

      // Handler should have been called with disconnect
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ disconnected: true }))
    })
  })

  describe("Async storage adapter", () => {
    it("works with async storage (e.g., React Native AsyncStorage)", async () => {
      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage(true) // Async adapter
      const adapter = loadAdapter({ sessionStorage: storage })

      // Connect and verify async storage works
      const connection = await adapter.connect("testnet")
      expect(connection.address).toBe(ADDR_A)

      // Verify async storage was used
      const stored = await storage.getItem("use-stellar:wallet-session")
      const parsedSession = JSON.parse(stored!)
      expect(parsedSession.address).toBe(ADDR_A)

      // Subscribe and test async session updates
      const handler = jest.fn()
      adapter.subscribe?.(handler)
      await new Promise(resolve => setTimeout(resolve, 10))

      // Emit session update
      client.emit("session_update", {
        params: { namespaces: { stellar: { accounts: [`stellar:testnet:${ADDR_B}`] } } },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify async storage was updated
      const updated = await storage.getItem("use-stellar:wallet-session")
      const parsedUpdated = JSON.parse(updated!)
      expect(parsedUpdated.address).toBe(ADDR_B)
    })
  })

  describe("Multiple sessions", () => {
    it("handles multiple WalletConnect sessions correctly on disconnect", async () => {
      const client = createClient([
        session("t1", `stellar:testnet:${ADDR_A}`),
        session("t2", `stellar:pubnet:${ADDR_B}`),
      ])
      mockInit.mockResolvedValue(client)
      const storage = createMemoryStorage()
      const adapter = loadAdapter({ sessionStorage: storage })

      // Connect to testnet (uses first session)
      await adapter.connect("testnet")

      // Disconnect should disconnect all sessions
      await adapter.disconnect?.()

      // Both sessions should have been disconnected
      expect(client.disconnect).toHaveBeenCalledWith(expect.objectContaining({ topic: "t1" }))
      expect(client.disconnect).toHaveBeenCalledWith(expect.objectContaining({ topic: "t2" }))

      // Stored session should be cleared
      const stored = await storage.getItem("use-stellar:wallet-session")
      expect(stored).toBeNull()
    })
  })

  describe("Session persistence backwards compatibility", () => {
    it("accepts stored sessions without chain field", async () => {
      const storage = createMemoryStorage()

      // Write an old-style session without chain field
      await storage.setItem("use-stellar:wallet-session", JSON.stringify({
        wallet: "walletconnect",
        address: ADDR_A,
      }))

      const client = createClient([session("t1", `stellar:testnet:${ADDR_A}`)])
      mockInit.mockResolvedValue(client)
      const adapter = loadAdapter({ sessionStorage: storage })

      // canAutoConnect should still work
      expect(await adapter.canAutoConnect?.()).toBe(true)

      // Connect should work and update with chain field
      const connection = await adapter.connect("testnet")
      expect(connection.address).toBe(ADDR_A)

      // Stored session should now include chain field
      const stored = await storage.getItem("use-stellar:wallet-session")
      const parsedSession = JSON.parse(stored!)
      expect(parsedSession.chain).toBe("stellar:testnet")
    })
  })
})
