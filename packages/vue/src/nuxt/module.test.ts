jest.mock("@nuxt/kit", () => ({
  addImports: jest.fn(),
  addPlugin: jest.fn(),
  createResolver: jest.fn(() => ({ resolve: (path: string) => `resolved:${path}` })),
  defineNuxtModule: jest.fn(definition => definition),
}))

jest.mock(
  "#app",
  () => ({
    defineNuxtPlugin: (plugin: unknown) => plugin,
    useRuntimeConfig: jest.fn(),
  }),
  { virtual: true }
)

jest.mock("../plugin", () => ({
  createStellarRuntime: jest.fn(options => ({ id: Symbol("runtime"), options })),
  restoreWalletSession: jest.fn(),
  STELLAR_RUNTIME_KEY: Symbol("stellar"),
}))

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
        network: "mainnet" as const,
        networkConfig: { horizonUrl: "https://horizon.example" },
        queryConfig: { staleTime: 1_000 },
        autoConnect: false,
      },
    },
  }
  const first = { vueApp: { provide: jest.fn() } }
  const second = { vueApp: { provide: jest.fn() } }

  await installStellarRuntime(first, config, false)
  await installStellarRuntime(second, config, false)

  expect(mockCreateRuntime).toHaveBeenCalledTimes(2)
  expect(mockCreateRuntime).toHaveBeenCalledWith({
    network: "mainnet",
    networkConfig: { horizonUrl: "https://horizon.example" },
    queryConfig: { staleTime: 1_000 },
  })
  const firstRuntime = first.vueApp.provide.mock.calls[0][1]
  const secondRuntime = second.vueApp.provide.mock.calls[0][1]
  expect(firstRuntime).not.toBe(secondRuntime)
  expect(first.vueApp.provide).toHaveBeenCalledWith(STELLAR_RUNTIME_KEY, firstRuntime)
})

test("restores wallets only for a client app with autoConnect enabled", async () => {
  const config = {
    public: { stellar: { autoConnect: { enabled: true, storage: "session" as const } } },
  }
  const serverApp = { vueApp: { provide: jest.fn() } }
  const clientApp = { vueApp: { provide: jest.fn() } }

  await installStellarRuntime(serverApp, config, false)
  expect(mockRestore).not.toHaveBeenCalled()

  await installStellarRuntime(clientApp, config, true)
  expect(mockRestore).toHaveBeenCalledWith(clientApp.vueApp.provide.mock.calls[0][1], "session")
})

test("default Nuxt plugin reads runtimeConfig for each invocation", async () => {
  const config = { public: { stellar: { network: "testnet", autoConnect: false } } }
  mockUseRuntimeConfig.mockReturnValue(config)
  const app = { vueApp: { provide: jest.fn() } }

  await (nuxtPlugin as (nuxtApp: { vueApp: { provide: jest.Mock } }) => Promise<void>)(app)

  expect(mockUseRuntimeConfig).toHaveBeenCalledTimes(1)
  expect(mockCreateRuntime).toHaveBeenCalledWith({ network: "testnet" })
})
