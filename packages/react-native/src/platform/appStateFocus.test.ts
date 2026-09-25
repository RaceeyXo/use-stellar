import { createAppStateFocusManager, createAlwaysFocusedManager } from "./appStateFocus"

describe("appStateFocus", () => {
  describe("createAlwaysFocusedManager", () => {
    it("always returns focused", () => {
      const manager = createAlwaysFocusedManager()
      expect(manager.isFocused()).toBe(true)
    })

    it("subscription immediately notifies focused", () => {
      const manager = createAlwaysFocusedManager()
      const handler = jest.fn()

      const unsubscribe = manager.subscribe(handler)

      expect(handler).toHaveBeenCalledWith(true)
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("unsubscribe returns a function", () => {
      const manager = createAlwaysFocusedManager()
      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)

      expect(typeof unsubscribe).toBe("function")
      unsubscribe()
    })
  })

  describe("createAppStateFocusManager", () => {
    let mockAppState: any

    beforeEach(() => {
      jest.resetModules()
      jest.clearAllMocks()
      mockAppState = null
    })

    it("returns always-focused manager when AppState is unavailable", () => {
      // Mock require to throw
      jest.doMock("react-native", () => {
        throw new Error("Module not found")
      })

      const manager = createAppStateFocusManager()
      expect(manager.isFocused()).toBe(true)
    })

    it("handles addEventListener errors gracefully", () => {
      // This test verifies that if addEventListener fails, the manager still works
      mockAppState = {
        addEventListener: jest.fn(() => {
          throw new Error("addEventListener failed")
        }),
        currentState: "active",
      }

      jest.doMock("react-native", () => ({
        AppState: mockAppState,
      }))

      const manager = createAppStateFocusManager()
      expect(manager.isFocused()).toBe(true)

      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)
      expect(handler).toHaveBeenCalledWith(true)

      unsubscribe()
    })

    it("handles currentState access errors gracefully", () => {
      mockAppState = {
        addEventListener: jest.fn(),
        get currentState() {
          throw new Error("currentState access failed")
        },
      }

      jest.doMock("react-native", () => ({
        AppState: mockAppState,
      }))

      const manager = createAppStateFocusManager()
      // Should default to focused when access fails
      expect(manager.isFocused()).toBe(true)
    })

    it("subscriber receives immediate notification", () => {
      mockAppState = {
        addEventListener: jest.fn(),
        currentState: "active",
      }

      jest.doMock("react-native", () => ({
        AppState: mockAppState,
      }))

      const manager = createAppStateFocusManager()
      const handler = jest.fn()

      manager.subscribe(handler)

      expect(handler).toHaveBeenCalledWith(true)
    })

    it("suppresses handler errors without breaking app", () => {
      mockAppState = {
        addEventListener: jest.fn(),
        currentState: "active",
      }

      jest.doMock("react-native", () => ({
        AppState: mockAppState,
      }))

      const manager = createAppStateFocusManager()
      const errorHandler = jest.fn(() => {
        throw new Error("Handler error")
      })
      const goodHandler = jest.fn()

      manager.subscribe(errorHandler)
      manager.subscribe(goodHandler)

      // Both handlers should be called
      expect(errorHandler).toHaveBeenCalled()
      expect(goodHandler).toHaveBeenCalled()
    })

    it("returns function to unsubscribe", () => {
      mockAppState = {
        addEventListener: jest.fn(),
        currentState: "active",
      }

      jest.doMock("react-native", () => ({
        AppState: mockAppState,
      }))

      const manager = createAppStateFocusManager()
      const handler = jest.fn()
      const unsubscribe = manager.subscribe(handler)

      expect(typeof unsubscribe).toBe("function")

      jest.clearAllMocks()
      unsubscribe()
    })
  })
})
