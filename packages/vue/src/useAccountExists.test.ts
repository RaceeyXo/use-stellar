import { createSSRApp, defineComponent, h } from "vue"
import { renderToString } from "@vue/server-renderer"
import { ref } from "vue"
import * as core from "use-stellar/core"
import { createStellarPlugin } from "./plugin"
import { createStellarTestHarness } from "./test-utils"
import { useAccountExists } from "./useAccountExists"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchAccountExists: jest.fn(),
}))

const fetchAccountExists = core.fetchAccountExists as jest.MockedFunction<
  typeof core.fetchAccountExists
>
const ADDR = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  fetchAccountExists.mockResolvedValue({ exists: true, reason: "exists" })
})

test("shares one request and drops subscribers when the scope is disposed", async () => {
  let resolve!: (value: { exists: boolean; reason: "exists" }) => void
  fetchAccountExists.mockReturnValueOnce(new Promise(done => (resolve = done)))
  const harness = createStellarTestHarness({ network: "testnet" })
  const first = harness.run(() => useAccountExists({ address: ADDR }))
  const second = harness.run(() => useAccountExists({ address: ADDR }))
  const key = core.accountKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network,
    ADDR
  )
  expect(fetchAccountExists).toHaveBeenCalledTimes(1)
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(2)
  resolve({ exists: true, reason: "exists" })
  await flush()
  expect(first.exists.value).toBe(true)
  expect(second.exists.value).toBe(true)
  harness.dispose()
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(0)
})

test("an empty address stays idle and a ref change refetches", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const address = ref<string | null>(null)
  const result = harness.run(() => useAccountExists({ address }))
  expect(result.exists.value).toBeNull()
  expect(result.error.value).toBeNull()
  expect(fetchAccountExists).not.toHaveBeenCalled()
  address.value = ADDR
  await flush()
  expect(fetchAccountExists).toHaveBeenCalledTimes(1)
  harness.dispose()
})

test("an unfunded account is exists false without an error", async () => {
  fetchAccountExists.mockResolvedValue({ exists: false, reason: "not_funded" })
  const harness = createStellarTestHarness({ network: "testnet" })
  const result = harness.run(() => useAccountExists({ address: ADDR }))
  await flush()
  expect(result.exists.value).toBe(false)
  expect(result.reason.value).toBe("not_funded")
  expect(result.error.value).toBeNull()
  harness.dispose()
})

test("429 and network failures keep the React error codes", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  fetchAccountExists.mockRejectedValueOnce({ response: { status: 429 } })
  const limited = harness.run(() => useAccountExists({ address: ADDR }))
  await flush()
  expect(limited.error.value?.code).toBe("RATE_LIMITED")

  fetchAccountExists.mockRejectedValueOnce(new Error("Failed to fetch"))
  await limited.refetch()
  await flush()
  expect(limited.error.value?.code).toBe("NETWORK_ERROR")
  harness.dispose()
})

test("renders on the server without fetching", async () => {
  const app = createSSRApp(
    defineComponent({
      setup() {
        const result = useAccountExists({ address: ADDR })
        return () => h("span", result.loading.value ? "loading" : "idle")
      },
    })
  )
  app.use(createStellarPlugin({ network: "testnet" }))
  expect(await renderToString(app)).toContain("idle")
  expect(fetchAccountExists).not.toHaveBeenCalled()
})
