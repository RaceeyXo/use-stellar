import { ref } from "vue"
import * as core from "use-stellar/core"
import { createStellarTestHarness } from "./test-utils"
import { usePaymentPaths } from "./usePaymentPaths"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchPaymentPaths: jest.fn(),
}))

const fetchPaymentPaths = core.fetchPaymentPaths as jest.MockedFunction<
  typeof core.fetchPaymentPaths
>

const TESTNET_USDC = { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" }

const PATH_RESULT: core.PaymentPath = {
  path: [],
  sourceAmount: "100.0000000",
  destinationAmount: "95.0000000",
  rate: "0.95",
}

const PATH_RESULT_2: core.PaymentPath = {
  path: [TESTNET_USDC],
  sourceAmount: "100.0000000",
  destinationAmount: "98.0000000",
  rate: "0.98",
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() =>
  fetchPaymentPaths.mockResolvedValue({
    paths: [PATH_RESULT, PATH_RESULT_2],
    lastUpdated: new Date(),
  })
)

test.each([
  [
    "static strictSend",
    {
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "100",
      destinationAsset: TESTNET_USDC,
    },
  ],
  [
    "static strictReceive",
    {
      mode: "strictReceive",
      sourceAsset: "XLM",
      sourceAmount: undefined as any,
      destinationAsset: TESTNET_USDC,
      destinationAmount: "95",
    },
  ],
  [
    "ref strictSend",
    ref({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "100",
      destinationAsset: TESTNET_USDC,
    }),
  ],
  [
    "getter strictSend",
    () => ({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "100",
      destinationAsset: TESTNET_USDC,
    }),
  ],
])("resolves %s options and returns normalized fields", async (_kind, options) => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => usePaymentPaths(options as any))
  await flush()

  expect(result.paths.value).toHaveLength(2)
  expect(result.paths.value[0]).toEqual(PATH_RESULT)
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  expect(result.lastUpdated.value).toBeInstanceOf(Date)
  expect(fetchPaymentPaths).toHaveBeenCalled()
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("shares cache between two composables with the same arguments", async () => {
  const harness = createStellarTestHarness()
  const options = {
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: TESTNET_USDC,
  } as const

  const result1 = harness.run(() => usePaymentPaths(options))
  const result2 = harness.run(() => usePaymentPaths(options))
  await flush()

  // Both should have the same data
  expect(result1.paths.value).toEqual(result2.paths.value)
  // Only one request should be made to the fetcher
  expect(fetchPaymentPaths).toHaveBeenCalledTimes(1)
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("refetch on options change", async () => {
  const harness = createStellarTestHarness()
  const options = ref({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: TESTNET_USDC,
  } as const)

  const result = harness.run(() => usePaymentPaths(options))
  await flush()
  expect(fetchPaymentPaths).toHaveBeenCalledTimes(1)

  options.value = {
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "200",
    destinationAsset: TESTNET_USDC,
  }
  await flush()
  expect(fetchPaymentPaths).toHaveBeenCalledTimes(2)

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("disables query when enabled is false", async () => {
  const harness = createStellarTestHarness()
  const options = ref({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: TESTNET_USDC,
    enabled: false,
  } as const)

  const result = harness.run(() => usePaymentPaths(options))
  await flush()

  expect(result.loading.value).toBe(false)
  expect(fetchPaymentPaths).not.toHaveBeenCalled()

  options.value = { ...options.value, enabled: true }
  await flush()
  expect(fetchPaymentPaths).toHaveBeenCalledTimes(1)

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("returns proper error types", async () => {
  const harness = createStellarTestHarness()
  const testError = new core.StellarError({
    code: "NOT_FOUND",
    message: "No path found",
  })

  fetchPaymentPaths.mockRejectedValueOnce(testError)

  const options = {
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: TESTNET_USDC,
  } as const

  const result = harness.run(() => usePaymentPaths(options))
  await flush()

  expect(result.error.value).toBeDefined()
  expect(result.error.value?.code).toBe("NOT_FOUND")
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("releases subscriptions when effect scope is disposed", async () => {
  const harness = createStellarTestHarness()
  const options = {
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: TESTNET_USDC,
  } as const

  const keyValue = core.paymentPathsKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network,
    options.mode,
    core.assetKeyStr(options.sourceAsset),
    core.assetKeyStr(options.destinationAsset),
    options.sourceAmount,
    undefined
  )

  harness.run(() => usePaymentPaths(options))
  await flush()

  expect(harness.runtime.queryStore.getSnapshot(keyValue)?.subscribers).toBe(1)

  harness.dispose()

  expect(harness.runtime.queryStore.getSnapshot(keyValue)?.subscribers).toBe(0)
  harness.runtime.queryStore.clear()
})
