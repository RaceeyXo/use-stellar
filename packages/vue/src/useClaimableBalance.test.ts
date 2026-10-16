import { ref } from "vue"
import * as core from "use-stellar/core"
import { createStellarTestHarness } from "./test-utils"
import { useClaimableBalance } from "./useClaimableBalance"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchClaimableBalances: jest.fn(),
}))

const fetchClaimableBalances = core.fetchClaimableBalances as jest.MockedFunction<
  typeof core.fetchClaimableBalances
>
const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const BALANCE: core.ClaimableBalance = {
  id: "00000000abc",
  asset: "native",
  amount: "12.5000000",
  claimants: [{ destination: ADDR_A, predicate: { unconditional: true } }],
  sponsor: ADDR_B,
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => fetchClaimableBalances.mockResolvedValue([BALANCE]))

test.each([
  ["static", ADDR_A],
  ["ref", ref(ADDR_A)],
  ["getter", () => ADDR_A],
])("resolves a %s address and returns normalized fields", async (_kind, address) => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => useClaimableBalance({ address }))
  await flush()

  expect(result.balances.value).toEqual([BALANCE])
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  expect(fetchClaimableBalances).toHaveBeenCalledWith(harness.runtime.networkConfig, {
    address: ADDR_A,
  })
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("defaults to the connected wallet and follows connect and disconnect", async () => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => useClaimableBalance())
  expect(result.loading.value).toBe(false)
  expect(fetchClaimableBalances).not.toHaveBeenCalled()

  harness.runtime.setWalletAddress(ADDR_A)
  await flush()
  expect(fetchClaimableBalances).toHaveBeenCalledTimes(1)
  expect(result.balances.value).toEqual([BALANCE])

  harness.runtime.setWalletAddress(null)
  await flush()
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  expect(result.balances.value).toEqual([])
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("switches cache keys, forwards staleTime, and releases subscriptions", async () => {
  const harness = createStellarTestHarness()
  const address = ref(ADDR_A)
  const staleTime = ref(5_000)
  const result = harness.run(() => useClaimableBalance({ address, staleTime }))
  await flush()
  const oldKey = core.claimableBalanceKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network,
    ADDR_A
  )
  expect(harness.runtime.queryStore.getSnapshot(oldKey)?.subscribers).toBe(1)

  address.value = ADDR_B
  await flush()
  const newKey = core.claimableBalanceKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network,
    ADDR_B
  )
  expect(harness.runtime.queryStore.getSnapshot(oldKey)?.subscribers).toBe(0)
  expect(harness.runtime.queryStore.getSnapshot(newKey)?.subscribers).toBe(1)
  await result.refetch()
  expect(fetchClaimableBalances).toHaveBeenCalledTimes(3)

  harness.dispose()
  expect(harness.runtime.queryStore.getSnapshot(newKey)?.subscribers).toBe(0)
  harness.runtime.queryStore.clear()
})

test("preserves core StellarError codes", async () => {
  const expected = new core.StellarError("VALIDATION_ERROR")
  fetchClaimableBalances.mockRejectedValueOnce(expected)
  const harness = createStellarTestHarness()
  const result = harness.run(() => useClaimableBalance({ address: ADDR_A }))
  await flush()
  expect(result.error.value).toBe(expected)
  expect(result.error.value?.code).toBe("VALIDATION_ERROR")
  harness.dispose()
  harness.runtime.queryStore.clear()
})
