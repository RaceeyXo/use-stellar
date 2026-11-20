import { createSecureStoreAdapter } from "./secureStoreSession"
let values: Map<string, string>
let native: {
  getItemAsync: jest.Mock<Promise<string | null>, [string]>
  setItemAsync: jest.Mock<Promise<void>, [string, string]>
  deleteItemAsync: jest.Mock<Promise<void>, [string]>
}
beforeEach(() => {
  jest.resetModules()
  values = new Map()
  native = {
    getItemAsync: jest.fn(async key => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      values.set(key, value)
    }),
    deleteItemAsync: jest.fn(async key => {
      values.delete(key)
    }),
  }
  jest.doMock("expo-secure-store", () => native, { virtual: true })
})
test("missing or unlinked optional module uses isolated in-memory storage", () => {
  jest.doMock(
    "expo-secure-store",
    () => {
      throw new Error("not linked")
    },
    { virtual: true }
  )
  const a = createSecureStoreAdapter()
  const b = createSecureStoreAdapter()
  expect(a.getItem("missing")).toBeNull()
  a.setItem("session", "old")
  a.setItem("session", "new")
  expect(a.getItem("session")).toBe("new")
  expect(b.getItem("session")).toBeNull()
  a.removeItem("session")
  expect(a.getItem("session")).toBeNull()
})
test("malformed optional module also falls back to memory", () => {
  jest.doMock("expo-secure-store", () => ({}), { virtual: true })
  const storage = createSecureStoreAdapter()
  storage.setItem("k", "value")
  expect(storage.getItem("k")).toBe("value")
})
test("package import never loads the optional native module", () => {
  const load = jest.fn(() => {
    throw new Error("must remain lazy")
  })
  jest.doMock("expo-secure-store", load, { virtual: true })
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("../index").createSecureStoreAdapter).toBeInstanceOf(Function)
  })
  expect(load).not.toHaveBeenCalled()
})
test.each([
  "",
  "hello",
  "😃漢字".repeat(2000),
  "\ud800\u0000\udfff",
  JSON.stringify({ wallet: "freighter", network: "testnet" }),
])("native storage round-trips arbitrary strings", async value => {
  const storage = createSecureStoreAdapter()
  expect(await storage.getItem("missing")).toBeNull()
  await storage.setItem("wallet:session/😃", value)
  expect(await storage.getItem("wallet:session/😃")).toBe(value)
  expect(await createSecureStoreAdapter().getItem("wallet:session/😃")).toBe(value)
  for (const [key, data] of native.setItemAsync.mock.calls) {
    expect(key).toMatch(/^[a-zA-Z0-9._-]+$/)
    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(1800)
  }
  await storage.removeItem("wallet:session/😃")
  expect(await storage.getItem("wallet:session/😃")).toBeNull()
  expect(values.size).toBe(0)
})
test("overwrite cleans old chunks and does not affect another key", async () => {
  const storage = createSecureStoreAdapter()
  await storage.setItem("session", "s".repeat(8000))
  await storage.setItem("other", "keep")
  const oldKeys = [...values.keys()].filter(
    key => key.startsWith("use-stellar.session.00730065007300730069006f006e.") && /\.\d+$/.test(key)
  )
  await storage.setItem("session", "short")
  expect(await storage.getItem("session")).toBe("short")
  expect(await storage.getItem("other")).toBe("keep")
  for (const key of oldKeys) expect(values.has(key)).toBe(false)
  await storage.removeItem("missing")
})
test("same-key operations serialize across adapters", async () => {
  const a = createSecureStoreAdapter()
  const b = createSecureStoreAdapter()
  await Promise.all([
    a.setItem("k", "first"),
    b.setItem("k", "second"),
    a.removeItem("k"),
    b.setItem("k", "last"),
  ])
  expect(await a.getItem("k")).toBe("last")
  expect(values.size).toBe(2)
})
test("failed staging preserves old value and the next write cleans pending chunks", async () => {
  const storage = createSecureStoreAdapter()
  await storage.setItem("k", "old")
  const write = native.setItemAsync.getMockImplementation()!
  native.setItemAsync
    .mockImplementationOnce(write)
    .mockImplementationOnce(write)
    .mockRejectedValueOnce(new Error("full"))
  await expect(storage.setItem("k", "x".repeat(5000))).rejects.toThrow("full")
  expect(await storage.getItem("k")).toBe("old")
  await storage.setItem("k", "recovered")
  expect(await storage.getItem("k")).toBe("recovered")
  expect(values.size).toBe(2)
})
test("removal cleans incomplete writes too", async () => {
  const storage = createSecureStoreAdapter()
  const write = native.setItemAsync.getMockImplementation()!
  native.setItemAsync
    .mockImplementationOnce(write)
    .mockImplementationOnce(write)
    .mockRejectedValueOnce(new Error("full"))
  await expect(storage.setItem("k", "x".repeat(5000))).rejects.toThrow()
  expect(await storage.getItem("k")).toBeNull()
  await storage.removeItem("k")
  expect(values.size).toBe(0)
})
test("deletion failure retains metadata and can be retried after restart", async () => {
  const storage = createSecureStoreAdapter()
  await storage.setItem("k", "x".repeat(5000))
  const remove = native.deleteItemAsync.getMockImplementation()!
  native.deleteItemAsync.mockImplementationOnce(remove).mockRejectedValueOnce(new Error("locked"))
  await expect(storage.removeItem("k")).rejects.toThrow("locked")
  expect(await storage.getItem("k")).toBeNull()
  await createSecureStoreAdapter().removeItem("k")
  expect(values.size).toBe(0)
})
test("cleanup failure after commit retains the new complete value and cleanup journal", async () => {
  const storage = createSecureStoreAdapter()
  await storage.setItem("k", "old")
  native.deleteItemAsync.mockRejectedValueOnce(new Error("locked"))
  await expect(storage.setItem("k", "new")).rejects.toThrow("locked")
  expect(await storage.getItem("k")).toBe("new")
  await storage.removeItem("k")
  expect(values.size).toBe(0)
})
test("native read failures propagate without switching to memory", async () => {
  const storage = createSecureStoreAdapter()
  native.getItemAsync.mockRejectedValueOnce(new Error("locked"))
  await expect(storage.getItem("k")).rejects.toThrow("locked")
  await storage.setItem("k", "native")
  expect(await storage.getItem("k")).toBe("native")
})
test("missing chunks and corrupt metadata cannot return partial sessions", async () => {
  const storage = createSecureStoreAdapter()
  await storage.setItem("k", "x".repeat(3000))
  const chunk = [...values.keys()].find(key => key.endsWith(".1"))!
  values.delete(chunk)
  expect(await storage.getItem("k")).toBeNull()
  const manifest = [...values.keys()].find(key => !/\.\d+$/.test(key))!
  values.set(
    manifest,
    JSON.stringify({ version: 1, active: { id: "bad/key", count: 999999999 }, pending: null })
  )
  await expect(storage.getItem("k")).rejects.toThrow("Invalid secure session metadata")
})
test("oversized sessions are rejected without touching an existing value", async () => {
  const storage = createSecureStoreAdapter()
  await storage.setItem("k", "old")
  expect(() => storage.setItem("k", "x".repeat(1800 * 1024))).toThrow("supported storage size")
  expect(await storage.getItem("k")).toBe("old")
})
