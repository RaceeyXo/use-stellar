jest.mock("@nuxt/kit", () => ({
  addImports: jest.fn(),
  addPlugin: jest.fn(),
  createResolver: jest.fn(() => ({ resolve: (path: string) => `resolved:${path}` })),
  defineNuxtModule: jest.fn(definition => definition),
}))
jest.mock(
  "#app",
  () => ({ defineNuxtPlugin: (plugin: unknown) => plugin, useRuntimeConfig: jest.fn() }),
  { virtual: true }
)
jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  readWalletSession: jest.fn(),
  getWalletAdapter: jest.fn(),
}))
import { addPlugin } from "@nuxt/kit"
import { useRuntimeConfig } from "#app"
import { readWalletSession, getWalletAdapter } from "use-stellar/core"
import * as plugin from "../plugin"
import { createModuleDefinition } from "./module-definition"
import nuxtPlugin, { installStellarRuntime } from "./runtime/plugin"
const address = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
const runtimes: plugin.StellarRuntime[] = []
beforeEach(() => {
  jest.clearAllMocks()
  ;(readWalletSession as jest.Mock).mockResolvedValue(null)
})
afterEach(() => {
  jest.restoreAllMocks()
  Reflect.deleteProperty(globalThis, "window")
  for (const runtime of runtimes.splice(0)) runtime.queryStore.clear()
})
function app() {
  const provide = jest.fn((_key, value: plugin.StellarRuntime) => {
    runtimes.push(value)
  })
  return { vueApp: { provide } }
}
test("registers the packaged runtime plugin", () => {
  const moduleDefinition = createModuleDefinition("file:///package/dist/nuxt/module.mjs")
  expect(moduleDefinition.meta).toEqual(
    expect.objectContaining({ name: "@use-stellar/vue", configKey: "stellar" })
  )
  moduleDefinition.setup()
  expect(addPlugin).toHaveBeenCalledWith({ src: "resolved:./runtime/plugin" })
})
test("Nuxt delegates configuration and creates isolated testnet runtimes through the shared installer", async () => {
  const install = jest.spyOn(plugin, "installStellarRuntime")
  const stellar = {
    network: "testnet" as const,
    networkConfig: { horizonUrl: "https://horizon-testnet.stellar.org" },
    queryConfig: { staleTime: 1000 },
    autoConnect: false,
  }
  const first = app(),
    second = app()
  await installStellarRuntime(first, { public: { stellar } }, false)
  await installStellarRuntime(second, { public: { stellar } }, false)
  expect(install).toHaveBeenCalledWith(first.vueApp, stellar, false)
  const runtime = first.vueApp.provide.mock.calls[0][1]
  expect(runtime).not.toBe(second.vueApp.provide.mock.calls[0][1])
  expect(runtime.network).toBe("testnet")
  expect(runtime.networkConfig.horizonUrl).toBe(stellar.networkConfig.horizonUrl)
  expect(first.vueApp.provide).toHaveBeenCalledWith(plugin.STELLAR_RUNTIME_KEY, runtime)
  expect(readWalletSession).not.toHaveBeenCalled()
})
test("Nuxt awaits the same silent client restore and honors session storage", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} })
  ;(readWalletSession as jest.Mock).mockResolvedValue({
    wallet: "freighter",
    address,
    chain: "stellar:testnet",
  })
  const connect = jest.fn(async () => ({ wallet: "freighter", address }))
  ;(getWalletAdapter as jest.Mock).mockReturnValue({
    metadata: { name: "Freighter" },
    isAvailable: async () => true,
    canAutoConnect: async () => true,
    connect,
    getNetworkDetails: async () => ({
      network: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
    }),
  })

import { addImports, addPlugin } from "@nuxt/kit"
import { useRuntimeConfig } from "#app"
import { createStellarRuntime, restoreWalletSession, STELLAR_RUNTIME_KEY } from "../plugin"
import { composableNames, createModuleDefinition } from "./module-definition"
import nuxtPlugin, { installStellarRuntime } from "./runtime/plugin"

const mockAddPlugin = addPlugin as jest.Mock
const mockAddImports = addImports as jest.Mock
const mockUseRuntimeConfig = useRuntimeConfig as jest.Mock
const mockCreateRuntime = createStellarRuntime as jest.Mock
const mockRestore = restoreWalletSession as jest.Mock

beforeEach(() => {
  mockAddPlugin.mockClear()
  mockAddImports.mockClear()
  mockUseRuntimeConfig.mockReset()
  mockCreateRuntime.mockClear()
  mockRestore.mockReset()
})

const fakeExports = {
  useBalance: () => null,
  useSendPayment: () => null,
  createStellarPlugin: () => null,
  VueQueryStore: class {},
  NETWORK_CONFIGS: {},
  user: "not a composable",
}

test("registers the packaged runtime plugin", async () => {
  const moduleDefinition = createModuleDefinition(
    "file:///package/dist/nuxt/module.mjs",
    async () => ({})
  )
  expect(moduleDefinition.meta).toEqual(
    expect.objectContaining({ name: "@use-stellar/vue", configKey: "stellar" })
  )
  expect(moduleDefinition.defaults).toEqual({ autoImports: true })
  await moduleDefinition.setup()
  expect(mockAddPlugin).toHaveBeenCalledWith({ src: "resolved:./runtime/plugin" })
})

test("auto-imports every exported use* composable from the package (#499)", async () => {
  const moduleDefinition = createModuleDefinition("file:///m.mjs", async () => fakeExports)
  await moduleDefinition.setup(moduleDefinition.defaults)
  expect(mockAddImports).toHaveBeenCalledWith([
    { name: "useBalance", from: "@use-stellar/vue" },
    { name: "useSendPayment", from: "@use-stellar/vue" },
  ])
})

test("autoImports: false keeps imports explicit (#499)", async () => {
  const loadExports = jest.fn(async () => fakeExports)
  const moduleDefinition = createModuleDefinition("file:///m.mjs", loadExports)
  await moduleDefinition.setup({ autoImports: false })
  expect(mockAddImports).not.toHaveBeenCalled()
  expect(loadExports).not.toHaveBeenCalled()
  expect(mockAddPlugin).toHaveBeenCalled()
})

test("in a Nuxt fixture app, useBalance resolves without an import (#499)", async () => {
  // The real package entry, as a Nuxt app would load it: the module registers each
  // composable, and the auto-import registry hands `useBalance` the package's own function.
  const packageExports = jest.requireActual("../index") as Record<string, unknown>
  const moduleDefinition = createModuleDefinition("file:///m.mjs", async () => packageExports)
  await moduleDefinition.setup(moduleDefinition.defaults)

  const registry = new Map<string, unknown>(
    (mockAddImports.mock.calls[0][0] as { name: string; from: string }[]).map(entry => [
      entry.name,
      entry.from === "@use-stellar/vue" ? packageExports[entry.name] : undefined,
    ])
  )
  expect(registry.get("useBalance")).toBe(packageExports.useBalance)
  // Every exported composable is registered, and nothing else.
  expect([...registry.keys()]).toEqual(composableNames(packageExports))
  expect(registry.has("useSorobanWrite")).toBe(true)
  expect(registry.has("createStellarPlugin")).toBe(false)
})

test("reads public stellar configuration and creates one runtime per Nuxt app", async () => {
  const config = {
    public: {
      stellar: {
        network: "testnet" as const,
        autoConnect: { enabled: true, storage: "session" as const },
      },
    },
  }
  const server = app(),
    client = app()
  await installStellarRuntime(server, config, false)
  expect(readWalletSession).not.toHaveBeenCalled()
  const ready = installStellarRuntime(client, config, true)
  const runtime = client.vueApp.provide.mock.calls[0][1]
  expect(runtime.wallet.connecting).toBe(true)
  await ready
  expect(readWalletSession).toHaveBeenCalledWith("session")
  expect(connect).toHaveBeenCalledWith("testnet")
  expect(runtime.wallet).toMatchObject({ connected: true, connecting: false, address })
})
test("default Nuxt plugin reads runtimeConfig and stays inert during SSR", async () => {
  const stellar = { network: "testnet", autoConnect: true }
  ;(useRuntimeConfig as jest.Mock).mockReturnValue({ public: { stellar } })
  const install = jest.spyOn(plugin, "installStellarRuntime")
  const nuxt = app()
  await (nuxtPlugin as (nuxtApp: typeof nuxt) => Promise<void>)(nuxt)
  expect(useRuntimeConfig).toHaveBeenCalledTimes(1)
  expect(install).toHaveBeenCalledWith(nuxt.vueApp, stellar, false)
  expect(readWalletSession).not.toHaveBeenCalled()
})
