/**
 * WalletConnect Mock
 * ──────────────────
 * Provides a controllable mock of WalletConnect client lifecycle.
 * 
 * Enables tests to:
 * - Simulate connection/disconnection flows
 * - Mock signing interactions
 * - Track session state transitions
 * - Test error conditions
 */

export interface MockWalletConnectSession {
  topic: string
  peer: { name: string; url: string; icons: string[] }
  namespaces: Record<string, { chains: string[]; methods: string[]; events: string[] }>
}

export interface MockWalletConnectClient {
  isConnected: boolean
  session: MockWalletConnectSession | null
  connect(): Promise<{ uri?: string; topic?: string }>
  disconnect(): Promise<void>
  sign(_message: string): Promise<string>
  reset(): void
}

/**
 * Singleton mock instance for WalletConnect client.
 * Tests interact with this via setWalletConnectConnected() helper.
 */
const mockWalletConnectClient: MockWalletConnectClient = {
  isConnected: false,
  session: null,

  async connect(): Promise<{ uri?: string; topic?: string }> {
    this.isConnected = true
    this.session = {
      topic: "test_topic_12345",
      peer: {
        name: "Test Wallet",
        url: "https://test.wallet",
        icons: [],
      },
      namespaces: {
        stellar: {
          chains: ["stellar:testnet"],
          methods: ["stellar_signXDR"],
          events: [],
        },
      },
    }
    return { uri: "wc:...", topic: "test_topic_12345" }
  },

  async disconnect(): Promise<void> {
    this.isConnected = false
    this.session = null
  },

  async sign(message: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error("Not connected to wallet")
    }
    // Return a fake signature (64 hex chars)
    return Buffer.from(message).toString("hex").padEnd(128, "0")
  },

  reset() {
    this.isConnected = false
    this.session = null
  },
}

/**
 * Helper to simulate WalletConnect connection.
 * 
 * @example
 * await setWalletConnectConnected(true)
 * expect(client.isConnected).toBe(true)
 */
export async function setWalletConnectConnected(isConnected: boolean): Promise<void> {
  if (isConnected) {
    await mockWalletConnectClient.connect()
  } else {
    await mockWalletConnectClient.disconnect()
  }
}

/**
 * Get the current connection state.
 */
export function isWalletConnectConnected(): boolean {
  return mockWalletConnectClient.isConnected
}

/**
 * Get the current session, if connected.
 */
export function getWalletConnectSession(): MockWalletConnectSession | null {
  return mockWalletConnectClient.session
}

/**
 * Mock a signing operation.
 * 
 * @example
 * const signature = await signWithWalletConnect("message")
 * expect(signature).toBeDefined()
 */
export async function signWithWalletConnect(message: string): Promise<string> {
  return mockWalletConnectClient.sign(message)
}

/**
 * Clear connection state and reset to disconnected.
 * Called by setup.ts beforeEach.
 */
export function resetWalletConnectMock(): void {
  mockWalletConnectClient.reset()
}

export default mockWalletConnectClient
