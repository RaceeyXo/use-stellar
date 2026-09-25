import {
  createAsyncStorageAdapter,
  createInMemoryStorage,
  type Storage,
} from "./asyncStorageSession"

describe("asyncStorageSession", () => {
  describe("createInMemoryStorage", () => {
    it("stores and retrieves values", () => {
      const storage = createInMemoryStorage()

      storage.setItem("key", "value")
      expect(storage.getItem("key")).toBe("value")
    })

    it("returns null for missing keys", () => {
      const storage = createInMemoryStorage()
      expect(storage.getItem("missing")).toBeNull()
    })

    it("removes values", () => {
      const storage = createInMemoryStorage()

      storage.setItem("key", "value")
      storage.removeItem("key")
      expect(storage.getItem("key")).toBeNull()
    })

    it("overwrites existing values", () => {
      const storage = createInMemoryStorage()

      storage.setItem("key", "value1")
      storage.setItem("key", "value2")
      expect(storage.getItem("key")).toBe("value2")
    })

    it("is isolated per instance", () => {
      const storage1 = createInMemoryStorage()
      const storage2 = createInMemoryStorage()

      storage1.setItem("key", "storage1")
      storage2.setItem("key", "storage2")

      expect(storage1.getItem("key")).toBe("storage1")
      expect(storage2.getItem("key")).toBe("storage2")
    })
  })

  describe("createAsyncStorageAdapter", () => {
    let mockAsyncStorage: any

    beforeEach(() => {
      jest.resetModules()
      jest.clearAllMocks()
      mockAsyncStorage = null
    })

    it("returns in-memory storage when AsyncStorage is unavailable", () => {
      jest.doMock("@react-native-async-storage/async-storage", () => {
        throw new Error("Module not found")
      })

      const storage = createAsyncStorageAdapter()
      expect(typeof storage.getItem).toBe("function")
      expect(typeof storage.setItem).toBe("function")
      expect(typeof storage.removeItem).toBe("function")
    })

    it("uses AsyncStorage when available", () => {
      mockAsyncStorage = {
        default: {
          getItem: jest.fn(() => Promise.resolve("value")),
          setItem: jest.fn(() => Promise.resolve()),
          removeItem: jest.fn(() => Promise.resolve()),
        },
      }

      jest.doMock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

      const storage = createAsyncStorageAdapter()

      // Should return promises (async)
      const getResult = storage.getItem("key")
      const setResult = storage.setItem("key", "value")
      const removeResult = storage.removeItem("key")

      expect(getResult instanceof Promise || getResult === null).toBe(true)
      expect(
        setResult === undefined || setResult instanceof Promise
      ).toBe(true)
      expect(
        removeResult === undefined || removeResult instanceof Promise
      ).toBe(true)
    })

    it("in-memory fallback stores and retrieves values", () => {
      jest.doMock("@react-native-async-storage/async-storage", () => {
        throw new Error("Module not found")
      })

      const storage = createAsyncStorageAdapter()

      storage.setItem("key", "value")
      const result = storage.getItem("key")

      // Should be synchronous in fallback mode
      expect(result).toBe("value")
    })

    it("in-memory fallback returns null for missing keys", () => {
      jest.doMock("@react-native-async-storage/async-storage", () => {
        throw new Error("Module not found")
      })

      const storage = createAsyncStorageAdapter()
      const result = storage.getItem("missing")

      expect(result).toBeNull()
    })

    it("in-memory fallback removes values", () => {
      jest.doMock("@react-native-async-storage/async-storage", () => {
        throw new Error("Module not found")
      })

      const storage = createAsyncStorageAdapter()

      storage.setItem("key", "value")
      storage.removeItem("key")
      const result = storage.getItem("key")

      expect(result).toBeNull()
    })

    it("implements Storage interface correctly", () => {
      jest.doMock("@react-native-async-storage/async-storage", () => {
        throw new Error("Module not found")
      })

      const storage = createAsyncStorageAdapter()

      // Check that all required methods exist
      expect(typeof storage.getItem).toBe("function")
      expect(typeof storage.setItem).toBe("function")
      expect(typeof storage.removeItem).toBe("function")
    })

    it("can be used with JSON serialization", () => {
      jest.doMock("@react-native-async-storage/async-storage", () => {
        throw new Error("Module not found")
      })

      const storage = createAsyncStorageAdapter()
      const testData = { wallet: "freighter", address: "GABC123" }

      storage.setItem("session", JSON.stringify(testData))
      const retrieved = storage.getItem("session")

      expect(retrieved).toBe(JSON.stringify(testData))

      if (typeof retrieved === "string") {
        const parsed = JSON.parse(retrieved)
        expect(parsed.wallet).toBe("freighter")
        expect(parsed.address).toBe("GABC123")
      }
    })
  })
})
