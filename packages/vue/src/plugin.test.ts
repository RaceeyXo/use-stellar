import { createApp, createSSRApp, watchEffect } from "vue"
import { getWalletAdapter, readWalletSession, type WalletState } from "use-stellar/core"
import {
  createStellarPlugin,
  createStellarRuntime,
  installStellarRuntime,
  restoreWalletSession,
  useStellarRuntime,
  STELLAR_RUNTIME_KEY,
  type StellarRuntime,
} from "./plugin"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  getWalletAdapter: jest.fn(),
  readWalletSession: jest.fn(),
}))
const read = readWalletSession as jest.Mock
const getAdapter = getWalletAdapter as jest.Mock
const address = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
const manualAddress = "GDS3CXXLBJO6MK3W7HQ777S6Y4MNBCBR7BHKV44FS2QC5QKQPZ5EF4OO"
const passphrase = "Test SDF Network ; September 2015"
const runtimes: StellarRuntime[] = []
let adapter: {
  metadata: { name: string }
  isAvailable: jest.Mock
  canAutoConnect?: jest.Mock
  connect: jest.Mock
  getNetworkDetails: jest.Mock
}
function runtime() {
  const value = createStellarRuntime({ network: "testnet" })
  runtimes.push(value)
  return value
}
function browser() {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}
beforeEach(() => {
  jest.clearAllMocks()
  browser()
  read.mockResolvedValue({ wallet: "freighter", address, chain: "stellar:testnet" })
  adapter = {
    metadata: { name: "Freighter" },
    isAvailable: jest.fn(async () => true),
    canAutoConnect: jest.fn(async () => true),
    connect: jest.fn(async () => ({ wallet: "freighter", address })),
    getNetworkDetails: jest.fn(async () => ({ network: "testnet", networkPassphrase: passphrase })),
  }
  getAdapter.mockReturnValue(adapter)
})
afterEach(() => {
  Reflect.deleteProperty(globalThis, "window")
  for (const value of runtimes.splice(0)) value.queryStore.clear()
})

test("plain Vue provides the runtime before restoring and connects silently on testnet", async () => {
  const app = createApp({})
  app.use(createStellarPlugin({ network: "testnet", autoConnect: true }))
  const value = app.runWithContext(useStellarRuntime)
  runtimes.push(value)
  expect(value.wallet.connecting).toBe(true)
  expect(value.wallet.connected).toBe(false)
  await restoreWalletSession(value)
  expect(read).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledWith("local")
  expect(adapter.canAutoConnect).toHaveBeenCalledWith("testnet")
  expect(adapter.connect).toHaveBeenCalledWith("testnet")
  expect(value.wallet).toMatchObject({
    connected: true,
    connecting: false,
    address,
    wallet: "freighter",
    walletNetwork: "testnet",
    walletNetworkPassphrase: passphrase,
  })
  expect(value.walletAddress.value).toBe(address)
})
test.each([undefined, false, { enabled: false, storage: "session" as const }])(
  "disabled option %p never reads storage",
  async autoConnect => {
    const provide = jest.fn()
    await installStellarRuntime({ provide }, { network: "testnet", autoConnect })
    const value = provide.mock.calls[0][1] as StellarRuntime
    runtimes.push(value)
    expect(read).not.toHaveBeenCalled()
    expect(value.wallet.connecting).toBe(false)
  }
)
test("object option chooses session storage and exposes pending state", async () => {
  const saved = deferred<{ wallet: string; address: string }>()
  read.mockReturnValue(saved.promise)
  const provide = jest.fn()
  const ready = installStellarRuntime(
    { provide },
    { network: "testnet", autoConnect: { enabled: true, storage: "session" } }
  )
  const value = provide.mock.calls[0][1] as StellarRuntime
  runtimes.push(value)
  expect(provide).toHaveBeenCalledWith(STELLAR_RUNTIME_KEY, value)
  expect(value.wallet.connecting).toBe(true)
  expect(read).toHaveBeenCalledWith("session")
  saved.resolve({ wallet: "freighter", address })
  await ready
  expect(value.wallet.connected).toBe(true)
  expect(value.wallet.connecting).toBe(false)
})
test("an enabled object defaults to local storage", async () => {
  const provide = jest.fn()
  await installStellarRuntime({ provide }, { autoConnect: { enabled: true } })
  runtimes.push(provide.mock.calls[0][1] as StellarRuntime)
  expect(read).toHaveBeenCalledWith("local")
})
test.each(["denied", "unsupported"])(
  "%s silent reconnect remembers the wallet without prompting",
  async mode => {
    if (mode === "unsupported") delete adapter.canAutoConnect
    else adapter.canAutoConnect!.mockResolvedValue(false)
    const value = runtime()
    await restoreWalletSession(value)
    expect(adapter.connect).not.toHaveBeenCalled()
    expect(adapter.getNetworkDetails).not.toHaveBeenCalled()
    expect(value.wallet).toMatchObject({
      connected: false,
      connecting: false,
      wallet: "freighter",
      walletName: "Freighter",
      address,
    })
    expect(value.walletAddress.value).toBe(address)
  }
)
test("a saved session for another chain is remembered without reconnecting", async () => {
  read.mockResolvedValue({ wallet: "freighter", address, chain: "stellar:other-chain" })
  const value = runtime()
  await restoreWalletSession(value)
  expect(adapter.canAutoConnect).not.toHaveBeenCalled()
  expect(adapter.connect).not.toHaveBeenCalled()
  expect(value.wallet).toMatchObject({
    wallet: "freighter",
    address,
    connected: false,
    connecting: false,
  })
})
test("SSR plugin installation and direct restoration never touch storage or wallets", async () => {
  Reflect.deleteProperty(globalThis, "window")
  const app = createSSRApp({})
  app.use(createStellarPlugin({ network: "testnet", autoConnect: true }))
  const value = app.runWithContext(useStellarRuntime)
  runtimes.push(value)
  await restoreWalletSession(value)
  expect(read).not.toHaveBeenCalled()
  expect(getAdapter).not.toHaveBeenCalled()
  expect(value.wallet.connecting).toBe(false)
})
test("an explicit server installation stays inert even if window exists", async () => {
  const provide = jest.fn()
  await installStellarRuntime({ provide }, { autoConnect: true }, false)
  runtimes.push(provide.mock.calls[0][1] as StellarRuntime)
  expect(read).not.toHaveBeenCalled()
})
test("missing or malformed sessions settle as disconnected", async () => {
  read.mockResolvedValue(null)
  const value = runtime()
  await restoreWalletSession(value)
  expect(getAdapter).not.toHaveBeenCalled()
  expect(value.wallet.connecting).toBe(false)
})
test("an unavailable adapter never prompts", async () => {
  adapter.isAvailable.mockResolvedValue(false)
  const value = runtime()
  await restoreWalletSession(value)
  expect(adapter.canAutoConnect).not.toHaveBeenCalled()
  expect(adapter.connect).not.toHaveBeenCalled()
  expect(value.wallet.connecting).toBe(false)
})
test.each(["storage", "adapter", "availability", "permission", "connection", "network"])(
  "%s failure is contained and clears connecting",
  async phase => {
    const failure = new Error("unavailable")
    if (phase === "storage") read.mockRejectedValueOnce(failure)
    if (phase === "adapter")
      getAdapter.mockImplementationOnce(() => {
        throw failure
      })
    if (phase === "availability") adapter.isAvailable.mockRejectedValueOnce(failure)
    if (phase === "permission") adapter.canAutoConnect!.mockRejectedValueOnce(failure)
    if (phase === "connection") adapter.connect.mockRejectedValueOnce(failure)
    if (phase === "network") adapter.getNetworkDetails.mockRejectedValueOnce(failure)
    const value = runtime()
    await expect(restoreWalletSession(value)).resolves.toBeUndefined()
    expect(value.wallet.connecting).toBe(false)
    expect(value.wallet.connected).toBe(false)
    if (["storage", "adapter", "availability", "permission"].includes(phase))
      expect(adapter.connect).not.toHaveBeenCalled()
  }
)
test("overlapping restore requests share one connection", async () => {
  const saved = deferred<{ wallet: string; address: string }>()
  read.mockReturnValue(saved.promise)
  const value = runtime()
  const first = restoreWalletSession(value)
  const second = restoreWalletSession(value)
  expect(second).toBe(first)
  saved.resolve({ wallet: "freighter", address })
  await Promise.all([first, second])
  expect(read).toHaveBeenCalledTimes(1)
  expect(adapter.connect).toHaveBeenCalledTimes(1)
})
test("manual connection while restore waits is never overwritten", async () => {
  const saved = deferred<{ wallet: string; address: string }>()
  read.mockReturnValue(saved.promise)
  const value = runtime()
  const ready = restoreWalletSession(value)
  value.setWallet({
    ...value.wallet,
    connected: true,
    connecting: false,
    wallet: "freighter",
    address: manualAddress,
  })
  saved.resolve({ wallet: "freighter", address })
  await ready
  expect(adapter.connect).not.toHaveBeenCalled()
  expect(value.wallet.address).toBe(manualAddress)
})
test("late adapter completion cannot undo a manual disconnect", async () => {
  const pending = deferred<{ wallet: string; address: string }>()
  adapter.connect.mockReturnValue(pending.promise)
  const value = runtime()
  const ready = restoreWalletSession(value)
  for (let i = 0; i < 5; i++) await Promise.resolve()
  expect(adapter.connect).toHaveBeenCalledTimes(1)
  const disconnected: WalletState = {
    ...value.wallet,
    connected: false,
    connecting: false,
    address: null,
  }
  value.setWallet(disconnected)
  pending.resolve({ wallet: "freighter", address })
  await ready
  expect(value.wallet).toBe(disconnected)
  expect(value.walletAddress.value).toBeNull()
  expect(adapter.getNetworkDetails).not.toHaveBeenCalled()
})
test("already connected or manually connecting wallets are left alone", async () => {
  const value = runtime()
  value.setWallet({ ...value.wallet, connected: true, address })
  await restoreWalletSession(value)
  value.setWallet({ ...value.wallet, connected: false, connecting: true })
  await restoreWalletSession(value)
  expect(read).not.toHaveBeenCalled()
})

test("connecting state is reactive and clears when no session is found", async () => {
  read.mockResolvedValue(null)
  const value = runtime()
  const states: boolean[] = []
  const stop = watchEffect(
    () => {
      states.push(value.wallet.connecting)
    },
    { flush: "sync" }
  )
  await restoreWalletSession(value)
  stop()
  expect(states).toEqual([false, true, false])
})

test.each(["replace", "passphrase"])(
  "a %s configuration change cancels a pending silent restore",
  async change => {
    const permission = deferred<boolean>()
    adapter.canAutoConnect!.mockReturnValue(permission.promise)
    const value = runtime()
    value.networkConfig = { ...value.networkConfig }
    const ready = restoreWalletSession(value)
    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(adapter.canAutoConnect).toHaveBeenCalledWith("testnet")
    if (change === "replace") value.networkConfig = { ...value.networkConfig }
    else value.networkConfig.networkPassphrase = "Test-only changed passphrase"
    permission.resolve(true)
    await ready
    expect(adapter.connect).not.toHaveBeenCalled()
    expect(value.wallet.connected).toBe(false)
    expect(value.wallet.connecting).toBe(false)
  }
)
