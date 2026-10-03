import { createNetInfoOnlineManager, createAlwaysOnlineManager } from "./netInfoOnline"

describe("netInfoOnline", () => {
  describe("createAlwaysOnlineManager", () => {
    it("always returns online", () => {
      const manager = createAlwaysOnlineManager()
      expect(manager.isOnline()).toBe(true)
    })

    it("subscription immediately notifies online", () => {
      const manager = createAlwaysOnlineManager()
      const handler = jest.fn()

      const unsubscribe = manager.subscribe(handler)

      expect(handler).toHaveBeenCalledWith(true)
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("unsubscribe returns a function", () => {
      const manager = createAlwaysOnlineManager()
      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)

      expect(typeof unsubscribe).toBe("function")
      unsubscribe()
    })
  })

  describe("createNetInfoOnlineManager", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ad-hoc native module double
    let mockNetInfo: any

    beforeEach(() => {
      jest.resetModules()
      jest.clearAllMocks()
      mockNetInfo = null
    })

    it("returns always-online manager when NetInfo is unavailable", () => {
      jest.doMock("@react-native-community/netinfo", () => {
        throw new Error("Module not found")
      })

      const manager = createNetInfoOnlineManager()
      expect(manager.isOnline()).toBe(true)
    })

    it("handles addEventListener errors gracefully", () => {
      mockNetInfo = {
        addEventListener: jest.fn(() => {
          throw new Error("addEventListener failed")
        }),
        fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
      }

      jest.doMock("@react-native-community/netinfo", () => mockNetInfo)

      const manager = createNetInfoOnlineManager()
      expect(manager.isOnline()).toBe(true)

      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)
      expect(handler).toHaveBeenCalledWith(true)

      unsubscribe()
    })

    it("handles fetch errors gracefully", () => {
      mockNetInfo = {
        addEventListener: jest.fn(() => ({
          unsubscribe: jest.fn(),
        })),
        fetch: jest.fn(() => Promise.reject(new Error("Fetch failed"))),
      }

      jest.doMock("@react-native-community/netinfo", () => mockNetInfo)

      const manager = createNetInfoOnlineManager()
      expect(manager.isOnline()).toBe(true)

      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)
      expect(handler).toHaveBeenCalledWith(true)

      unsubscribe()
    })

    it("subscriber receives immediate notification", () => {
      mockNetInfo = {
        addEventListener: jest.fn(() => ({
          unsubscribe: jest.fn(),
        })),
        fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
      }

      jest.doMock("@react-native-community/netinfo", () => mockNetInfo)

      const manager = createNetInfoOnlineManager()
      const handler = jest.fn()

      manager.subscribe(handler)

      expect(handler).toHaveBeenCalledWith(true)
    })

    it("handles null isConnected state as offline", () => {
      let emit: (state: { isConnected: boolean | null }) => void = () => {}
      mockNetInfo = {
        addEventListener: jest.fn(listener => {
          emit = listener
          return { unsubscribe: jest.fn() }
        }),
        fetch: jest.fn(() => new Promise(() => {})),
      }

      jest.doMock("@react-native-community/netinfo", () => mockNetInfo)

      const manager = createNetInfoOnlineManager()
      const handler = jest.fn()

      manager.subscribe(handler)
      // Simulate offline (null) after subscribing
      emit({ isConnected: null })

      // Should be called twice: once immediately (true), once from addEventListener
      expect(handler).toHaveBeenCalledWith(true) // immediate
      expect(handler).toHaveBeenCalledWith(false) // from event
    })

    it("suppresses handler errors without breaking app", () => {
      mockNetInfo = {
        addEventListener: jest.fn(() => ({
          unsubscribe: jest.fn(),
        })),
        fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
      }

      jest.doMock("@react-native-community/netinfo", () => mockNetInfo)

      const manager = createNetInfoOnlineManager()
      const errorHandler = jest.fn(() => {
        throw new Error("Handler error")
      })
      const goodHandler = jest.fn()

      manager.subscribe(errorHandler)
      manager.subscribe(goodHandler)

      expect(errorHandler).toHaveBeenCalled()
      expect(goodHandler).toHaveBeenCalled()
    })

    it("returns function to unsubscribe", () => {
      mockNetInfo = {
        addEventListener: jest.fn(() => ({
          unsubscribe: jest.fn(),
        })),
        fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
      }

      jest.doMock("@react-native-community/netinfo", () => mockNetInfo)

      const manager = createNetInfoOnlineManager()
      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)

      expect(typeof unsubscribe).toBe("function")

      jest.clearAllMocks()
      unsubscribe()
    })
  })
})
