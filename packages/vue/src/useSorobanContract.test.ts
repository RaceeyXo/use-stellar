import { nextTick, reactive, ref } from "vue"
import { xdr } from "@stellar/stellar-sdk"
import {
  ANONYMOUS_SIMULATION_SOURCE,
  argsKey,
  serializeKey,
  sorobanContractKey,
} from "use-stellar/core"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { useSorobanContract } from "./useSorobanContract"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  simulateContractCall: jest.fn(),
}))

import { simulateContractCall } from "use-stellar/core"

const mockSimulate = simulateContractCall as jest.Mock
const CONTRACT_A = "C" + "A".repeat(55)
const CONTRACT_B = "C" + "B".repeat(55)
const harnesses: StellarTestHarness[] = []

function createHarnessTracked(): StellarTestHarness {
  const harness = createHarness({ network: "testnet" })
  harnesses.push(harness)
  return harness
}

async function flush(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  mockSimulate.mockReset()
  mockSimulate.mockResolvedValue("decoded")
})

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test("uses the canonical Soroban key and returns decoded data", async () => {
  const harness = createHarnessTracked()
  const argument = xdr.ScVal.scvBool(true)
  const result = harness.run(() =>
    useSorobanContract<string>({ contractId: CONTRACT_A, method: "enabled", args: [argument] })
  )

  await flush()

  expect(result.data.value).toBe("decoded")
  expect(result.loading.value).toBe(false)
  expect(mockSimulate).toHaveBeenCalledWith(
    harness.runtime.networkConfig,
    expect.objectContaining({
      contractId: CONTRACT_A,
      method: "enabled",
      sourceAccount: ANONYMOUS_SIMULATION_SOURCE,
    })
  )
  const key = serializeKey(
    sorobanContractKey(
      harness.runtime.networkConfig.sorobanUrl,
      "testnet",
      CONTRACT_A,
      "enabled",
      argsKey([argument]),
      ANONYMOUS_SIMULATION_SOURCE,
      "raw"
    )
  )
  expect(harness.runtime.queryStore.subscriberCount(key)).toBe(1)
})

test("reactive inputs move the subscription and refetch under a new key", async () => {
  const harness = createHarnessTracked()
  const contractId = ref(CONTRACT_A)
  const method = ref("first")
  const result = harness.run(() => useSorobanContract({ contractId, method }))
  await flush()

  contractId.value = CONTRACT_B
  method.value = "second"
  await flush()

  expect(mockSimulate).toHaveBeenLastCalledWith(
    harness.runtime.networkConfig,
    expect.objectContaining({ contractId: CONTRACT_B, method: "second" })
  )
  expect(result.data.value).toBe("decoded")
  expect(mockSimulate).toHaveBeenCalledTimes(2)
})

test("unwraps Vue proxies before keying and simulation", async () => {
  const harness = createHarnessTracked()
  const original = xdr.ScVal.scvBool(true)
  const proxiedArgs = reactive([original])
  harness.run(() =>
    useSorobanContract({ contractId: CONTRACT_A, method: "proxied", args: proxiedArgs })
  )
  await flush()

  const passed = mockSimulate.mock.calls[0][1].args as unknown[]
  expect(passed[0]).toBe(original)
  expect(() => argsKey(passed)).not.toThrow()
})

test("null and empty inputs stay idle without an error", async () => {
  const harness = createHarnessTracked()
  const contractId = ref<string | null>(null)
  const result = harness.run(() => useSorobanContract({ contractId, method: "" }))
  await flush()

  expect(mockSimulate).not.toHaveBeenCalled()
  expect(result.data.value).toBeNull()
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  result.refetch()
  expect(mockSimulate).not.toHaveBeenCalled()
})

test("normalizes failures and force-refetches the active call", async () => {
  mockSimulate.mockRejectedValueOnce(new Error("rpc unavailable")).mockResolvedValueOnce(42)
  const harness = createHarnessTracked()
  const result = harness.run(() =>
    useSorobanContract<number>({ contractId: CONTRACT_A, method: "value" })
  )
  await flush()

  expect(result.error.value?.code).toBe("UNKNOWN")
  result.refetch()
  await flush()
  expect(result.data.value).toBe(42)
  expect(result.error.value).toBeNull()
  expect(mockSimulate).toHaveBeenCalledTimes(2)
})
