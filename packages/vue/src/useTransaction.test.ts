import { createSSRApp, defineComponent, h, ref } from "vue"
import { renderToString } from "@vue/server-renderer"
import * as core from "use-stellar/core"
import { createStellarPlugin } from "./plugin"
import { createStellarTestHarness } from "./test-utils"
import { useTransaction } from "./useTransaction"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchTransaction: jest.fn(),
}))

const fetchTransaction = core.fetchTransaction as jest.MockedFunction<typeof core.fetchTransaction>
const HASH = "a".repeat(64)

const pending = { hash: HASH, status: "pending" as const }
const success = {
  hash: HASH,
  status: "success" as const,
  ledger: 1,
  createdAt: "2024-01-01T00:00:00Z",
  fee: "100",
  envelope: "AAAA",
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  jest.useRealTimers()
  fetchTransaction.mockResolvedValue(success)
})

test("two readers share one request", async () => {
  let resolve!: (value: typeof success) => void
  fetchTransaction.mockReturnValueOnce(new Promise(done => (resolve = done)))
  const harness = createStellarTestHarness({ network: "testnet" })
  const first = harness.run(() => useTransaction({ hash: HASH }))
  const second = harness.run(() => useTransaction({ hash: HASH }))
  expect(fetchTransaction).toHaveBeenCalledTimes(1)
  resolve(success)
  await flush()
  expect(first.transaction.value?.status).toBe("success")
  expect(second.transaction.value?.hash).toBe(HASH)
  harness.dispose()
})

test("an empty hash stays idle", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const hash = ref<string | null>("")
  const result = harness.run(() => useTransaction({ hash }))
  expect(result.transaction.value).toBeNull()
  expect(result.error.value).toBeNull()
  expect(fetchTransaction).not.toHaveBeenCalled()
  hash.value = HASH
  await flush()
  expect(fetchTransaction).toHaveBeenCalledTimes(1)
  harness.dispose()
})

test("404, 429 and network failures use the React error codes", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  fetchTransaction.mockResolvedValueOnce({ hash: HASH, status: "not_found" })
  const result = harness.run(() => useTransaction({ hash: HASH }))
  await flush()
  expect(result.transaction.value?.status).toBe("not_found")
  expect(result.error.value).toBeNull()
  fetchTransaction.mockRejectedValueOnce({ response: { status: 429 } })
  await result.refetch()
  await flush()
  expect(result.error.value?.code).toBe("RATE_LIMITED")
  fetchTransaction.mockRejectedValueOnce(new Error("Failed to fetch"))
  await result.refetch()
  await flush()
  expect(result.error.value?.code).toBe("NETWORK_ERROR")
  harness.dispose()
})

test("polling stops on a final status and when the scope is disposed", async () => {
  jest.useFakeTimers()
  fetchTransaction.mockResolvedValue(pending)
  const harness = createStellarTestHarness({ network: "testnet" })
  const result = harness.run(() => useTransaction({ hash: HASH, watch: true }))
  await flush()
  expect(fetchTransaction).toHaveBeenCalledTimes(1)

  await jest.advanceTimersByTimeAsync(3000)
  await flush()
  expect(fetchTransaction.mock.calls.length).toBeGreaterThan(1)

  fetchTransaction.mockResolvedValue(success)
  await jest.advanceTimersByTimeAsync(3000)
  await flush()
  expect(result.transaction.value?.status).toBe("success")
  const settled = fetchTransaction.mock.calls.length
  await jest.advanceTimersByTimeAsync(9000)
  expect(fetchTransaction.mock.calls.length).toBe(settled)

  fetchTransaction.mockResolvedValue(pending)
  const again = harness.run(() => useTransaction({ hash: "b".repeat(64), watch: true }))
  await flush()
  const beforeDispose = fetchTransaction.mock.calls.length
  harness.dispose()
  await jest.advanceTimersByTimeAsync(9000)
  expect(fetchTransaction.mock.calls.length).toBe(beforeDispose)
  expect(again.transaction.value).toBeDefined()
  jest.useRealTimers()
})

test("renders on the server without fetching", async () => {
  const app = createSSRApp(
    defineComponent({
      setup() {
        const result = useTransaction({ hash: HASH, watch: true })
        return () => h("span", result.loading.value ? "loading" : "idle")
      },
    })
  )
  app.use(createStellarPlugin({ network: "testnet" }))
  expect(await renderToString(app)).toContain("idle")
  expect(fetchTransaction).not.toHaveBeenCalled()
})
