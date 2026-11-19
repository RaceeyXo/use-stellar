import { ref } from "vue"
import * as core from "use-stellar/core"
import { createStellarTestHarness } from "./test-utils"
import { useBalance } from "./useBalance"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchAccount: jest.fn(),
}))

const fetchAccount = core.fetchAccount as jest.MockedFunction<typeof core.fetchAccount>
const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

const account = (address: string): core.AccountInfo => ({
  address,
  sequence: "1",
  balances: [{ asset: "XLM", balance: "100.0000000" }],
  subentryCount: 0,
  thresholds: { lowThreshold: 1, medThreshold: 1, highThreshold: 1 },
  signers: [],
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  fetchAccount.mockImplementation(async (_network, { address }) => account(address))
})

test("fetches static and reactive addresses through the core query", async () => {
  const harness = createStellarTestHarness()
  const address = ref(ADDR_A)
  const result = harness.run(() => useBalance({ address }))
  await flush()
  expect(result.balance.value).toBe("100.0000000")

  address.value = ADDR_B
  await flush()
  expect(fetchAccount).toHaveBeenLastCalledWith(harness.runtime.networkConfig, { address: ADDR_B })
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("shares an in-flight request and releases subscriptions on disposal", async () => {
  let resolve!: (value: core.AccountInfo) => void
  fetchAccount.mockReturnValueOnce(new Promise(done => (resolve = done)))
  const harness = createStellarTestHarness()
  const first = harness.run(() => useBalance({ address: ADDR_A }))
  const second = harness.run(() => useBalance({ address: ADDR_A }))
  const key = core.accountKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network,
    ADDR_A
  )

  expect(fetchAccount).toHaveBeenCalledTimes(1)
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(2)
  resolve(account(ADDR_A))
  await flush()
  expect(first.balance.value).toBe("100.0000000")
  expect(second.balance.value).toBe("100.0000000")

  harness.dispose()
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(0)
  harness.runtime.queryStore.clear()
})

test("stays idle for empty input and refetch bypasses freshness", async () => {
  const harness = createStellarTestHarness()
  const address = ref<string | null>(null)
  const result = harness.run(() => useBalance({ address, staleTime: 60_000 }))
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  expect(fetchAccount).not.toHaveBeenCalled()

  address.value = ADDR_A
  await flush()
  await result.refetch()
  expect(fetchAccount).toHaveBeenCalledTimes(2)
  harness.dispose()
  harness.runtime.queryStore.clear()
})
