jest.mock("@nuxt/kit", () => ({
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
