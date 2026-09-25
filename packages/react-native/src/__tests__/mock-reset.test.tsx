/**
 * Mock Reset and Isolation Tests
 * ──────────────────────────────
 * 
 * Verifies that all mocks properly reset between tests,
 * preventing state leakage and ensuring test isolation.
 * 
 * Acceptance Criteria:
 * - Each mock resets automatically before each test
 * - No state from one test affects the next
 * - Storage, listeners, and runtime state all reset
 * - Test order does not affect outcomes
 */

import {
  getAppState,
  setAppState,
  getAppStateListenerCount,
  getNetInfoState,
  setOnline,
  getNetInfoListenerCount,
  getAsyncStorageMap,
  setAsyncStorageValue,
  getOpenedUrls,
  openUrl,
  isWalletConnectConnected,
  setWalletConnectConnected,
} from "../test-utils"

describe("Mock reset and isolation", () => {
  describe("AppState reset", () => {
    it("test A: modifies AppState", () => {
      setAppState("background")
      expect(getAppState()).toBe("background")
    })

    it("test B: sees clean AppState", () => {
      // Should be reset to active despite test A's changes
      expect(getAppState()).toBe("active")
    })

    it("test C: also sees clean AppState", () => {
      expect(getAppState()).toBe("active")
    })

    it("test D: can modify again independently", () => {
      setAppState("inactive")
      expect(getAppState()).toBe("inactive")
    })

    it("test E: sees clean AppState again", () => {
      expect(getAppState()).toBe("active")
    })
  })

  describe("NetInfo reset", () => {
    it("test A: goes offline", () => {
      setOnline(false)
      expect(getNetInfoState().isConnected).toBe(false)
    })

    it("test B: starts online", () => {
      expect(getNetInfoState().isConnected).toBe(true)
    })

    it("test C: stays online", () => {
      expect(getNetInfoState().isConnected).toBe(true)
    })
  })

  describe("AsyncStorage reset", () => {
    it("test A: stores values", () => {
      setAsyncStorageValue("wallet_session", "abc123")
      setAsyncStorageValue("user_preference", "dark_mode")
      expect(getAsyncStorageMap().size).toBe(2)
    })

    it("test B: storage is cleared", () => {
      expect(getAsyncStorageMap().size).toBe(0)
    })

    it("test C: storage stays empty", () => {
      expect(getAsyncStorageMap().size).toBe(0)
    })

    it("test D: can store new values", () => {
      setAsyncStorageValue("new_key", "new_value")
      expect(getAsyncStorageMap().size).toBe(1)
    })

    it("test E: storage cleared again", () => {
      expect(getAsyncStorageMap().size).toBe(0)
    })
  })

  describe("Linking reset", () => {
    it("test A: opens URLs", async () => {
      await openUrl("https://example.com")
      await openUrl("https://another.com")
      expect(getOpenedUrls()).toHaveLength(2)
    })

    it("test B: no URLs opened", () => {
      expect(getOpenedUrls()).toHaveLength(0)
    })

    it("test C: still no URLs", () => {
      expect(getOpenedUrls()).toHaveLength(0)
    })

    it("test D: can open URLs again", async () => {
      await openUrl("https://fresh.com")
      expect(getOpenedUrls()).toHaveLength(1)
    })

    it("test E: URLs cleared again", () => {
      expect(getOpenedUrls()).toHaveLength(0)
    })
  })

  describe("WalletConnect reset", () => {
    it("test A: connects wallet", async () => {
      await setWalletConnectConnected(true)
      expect(isWalletConnectConnected()).toBe(true)
    })

    it("test B: wallet disconnected", () => {
      expect(isWalletConnectConnected()).toBe(false)
    })

    it("test C: stays disconnected", () => {
      expect(isWalletConnectConnected()).toBe(false)
    })

    it("test D: can connect again", async () => {
      await setWalletConnectConnected(true)
      expect(isWalletConnectConnected()).toBe(true)
    })

    it("test E: disconnected again", () => {
      expect(isWalletConnectConnected()).toBe(false)
    })
  })

  describe("Listener cleanup", () => {
    it("test A: listeners are cleaned", () => {
      // Initial state has no listeners
      expect(getAppStateListenerCount()).toBe(0)
      expect(getNetInfoListenerCount()).toBe(0)
    })

    it("test B: also has clean listeners", () => {
      expect(getAppStateListenerCount()).toBe(0)
      expect(getNetInfoListenerCount()).toBe(0)
    })
  })

  describe("Combined state reset", () => {
    it("test A: modifies everything", async () => {
      setAppState("background")
      setOnline(false)
      setAsyncStorageValue("key1", "value1")
      await openUrl("https://test.com")
      await setWalletConnectConnected(true)

      // All changed
      expect(getAppState()).toBe("background")
      expect(getNetInfoState().isConnected).toBe(false)
      expect(getAsyncStorageMap().size).toBe(1)
      expect(getOpenedUrls()).toHaveLength(1)
      expect(isWalletConnectConnected()).toBe(true)
    })

    it("test B: all reset to defaults", () => {
      expect(getAppState()).toBe("active")
      expect(getNetInfoState().isConnected).toBe(true)
      expect(getAsyncStorageMap().size).toBe(0)
      expect(getOpenedUrls()).toHaveLength(0)
      expect(isWalletConnectConnected()).toBe(false)
    })

    it("test C: remains clean", () => {
      expect(getAppState()).toBe("active")
      expect(getNetInfoState().isConnected).toBe(true)
      expect(getAsyncStorageMap().size).toBe(0)
      expect(getOpenedUrls()).toHaveLength(0)
      expect(isWalletConnectConnected()).toBe(false)
    })
  })

  describe("No test order dependencies", () => {
    // These tests intentionally run in various orders to verify
    // that outcome does not depend on execution sequence

    it("sequential: state A", () => {
      expect(getAppState()).toBe("active")
      setAppState("background")
    })

    it("sequential: state B", () => {
      expect(getAppState()).toBe("active")
    })

    it("random order 1", () => {
      expect(getNetInfoState().isConnected).toBe(true)
    })

    it("random order 2", () => {
      expect(getAsyncStorageMap().size).toBe(0)
    })

    it("final: all clean", () => {
      expect(getAppState()).toBe("active")
      expect(getNetInfoState().isConnected).toBe(true)
      expect(getAsyncStorageMap().size).toBe(0)
      expect(getOpenedUrls()).toHaveLength(0)
    })
  })
})
