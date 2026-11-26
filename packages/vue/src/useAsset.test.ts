import { createSSRApp, defineComponent, h, ref } from "vue"
import { renderToString } from "@vue/server-renderer"
import * as core from "use-stellar/core"
import { createStellarPlugin } from "./plugin"
import { createStellarTestHarness } from "./test-utils"
import { useAsset } from "./useAsset"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchAsset: jest.fn(),
}))

const fetchAsset = core.fetchAsset as jest.MockedFunction<typeof core.fetchAsset>
const ISSUER = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const asset = {
  code: "USDC",
  issuer: ISSUER,
  supply: "1",
  numAccounts: 1,
  flags: { authRequired: false, authRevocable: false, authImmutable: false },
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  fetchAsset.mockResolvedValue(asset)
})

test("two readers share one request and release it on dispose", async () => {
  let resolve!: (value: typeof asset) => void
  fetchAsset.mockReturnValueOnce(new Promise(done => (resolve = done)))
  const harness = createStellarTestHarness({ network: "testnet" })
  const first = harness.run(() => useAsset({ code: "USDC", issuer: ISSUER }))
  const second = harness.run(() => useAsset({ code: "USDC", issuer: ISSUER }))
  expect(fetchAsset).toHaveBeenCalledTimes(1)
  resolve(asset)
  await flush()
  expect(first.asset.value?.code).toBe("USDC")
  expect(second.asset.value?.supply).toBe("1")
  harness.dispose()
  const key = core.assetKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network,
    "USDC",
    ISSUER
  )
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(0)
})

test("empty code or issuer disables the query", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const code = ref<string | null>(null)
  const result = harness.run(() => useAsset({ code, issuer: ISSUER }))
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  expect(fetchAsset).not.toHaveBeenCalled()
  code.value = "USDC"
  await flush()
  expect(fetchAsset).toHaveBeenCalledTimes(1)
  harness.dispose()
})

test("404, 429 and network failures use the React error codes", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  fetchAsset.mockRejectedValueOnce({ response: { status: 404 } })
  const result = harness.run(() => useAsset({ code: "USDC", issuer: ISSUER }))
  await flush()
  expect(result.error.value?.code).toBe("ACCOUNT_NOT_FOUND")
  fetchAsset.mockRejectedValueOnce({ response: { status: 429 } })
  await result.refetch()
  await flush()
  expect(result.error.value?.code).toBe("RATE_LIMITED")
  fetchAsset.mockRejectedValueOnce(new Error("Failed to fetch"))
  await result.refetch()
  await flush()
  expect(result.error.value?.code).toBe("NETWORK_ERROR")
  harness.dispose()
})

test("renders on the server without fetching", async () => {
  const app = createSSRApp(
    defineComponent({
      setup() {
        const result = useAsset({ code: "USDC", issuer: ISSUER })
        return () => h("span", result.loading.value ? "loading" : "idle")
      },
    })
  )
  app.use(createStellarPlugin({ network: "testnet" }))
  expect(await renderToString(app)).toContain("idle")
  expect(fetchAsset).not.toHaveBeenCalled()
})
