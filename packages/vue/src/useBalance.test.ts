import { ref } from "vue"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { useBalance } from "./useBalance"
import type { StellarPluginOptions } from "./plugin"

// GC timers scheduled on unsubscribe default to a 5-minute delay, which
// otherwise keeps the Jest process alive well past the test run. Every
// harness this suite creates is tracked and its store cleared on teardown.
const harnesses: StellarTestHarness[] = []
function createStellarTestHarness(options?: StellarPluginOptions): StellarTestHarness {
  const harness = createHarness(options)
  harnesses.push(harness)
  return harness
}

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

jest.mock("./horizon", () => ({
  getHorizonServer: jest.fn(),
  parseHorizonBalance: (b: unknown) => b,
}))

import { getHorizonServer } from "./horizon"

const mockGetServer = getHorizonServer as jest.Mock
const loadAccount = jest.fn()

const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

function accountFor(address: string) {
  return {
    id: address,
    balances: [{ asset: "XLM", balance: "100.0000000" }],
  }
}

beforeEach(() => {
  loadAccount.mockReset()
  loadAccount.mockImplementation(async (address: string) => accountFor(address))
  mockGetServer.mockReturnValue({ loadAccount })
})

test("fetches the balance for a static address", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const { balance, loading } = harness.run(() => useBalance({ address: ADDR_A }))

  expect(loading.value).toBe(true)
  await Promise.resolve()
  await Promise.resolve()

  expect(loadAccount).toHaveBeenCalledWith(ADDR_A)
  expect(balance.value).toBe("100.0000000")
  expect(loading.value).toBe(false)

  harness.dispose()
})

test("fetches the balance for a reactive ref address", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const address = ref(ADDR_A)
  const { balance } = harness.run(() => useBalance({ address }))

  await Promise.resolve()
  await Promise.resolve()
  expect(balance.value).toBe("100.0000000")
  expect(loadAccount).toHaveBeenCalledTimes(1)

  harness.dispose()
})

test("an address change unsubscribes from the old query and loads the new one", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const address = ref(ADDR_A)
  harness.run(() => useBalance({ address }))
  await Promise.resolve()
  await Promise.resolve()

  const oldKey = JSON.stringify([
    "account",
    "https://horizon-testnet.stellar.org",
    "testnet",
    ADDR_A,
  ])
  expect(harness.runtime.queryStore.subscriberCount(oldKey)).toBe(1)

  address.value = ADDR_B
  await Promise.resolve()
  await Promise.resolve()

  const newKey = JSON.stringify([
    "account",
    "https://horizon-testnet.stellar.org",
    "testnet",
    ADDR_B,
  ])
  expect(harness.runtime.queryStore.subscriberCount(oldKey)).toBe(0)
  expect(harness.runtime.queryStore.subscriberCount(newKey)).toBe(1)
  expect(loadAccount).toHaveBeenCalledWith(ADDR_B)

  harness.dispose()
})

test("two composable instances for the same address share one in-flight request", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })

  let resolveLoad: (value: unknown) => void = () => {}
  loadAccount.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveLoad = resolve
      })
  )

  const first = harness.run(() => useBalance({ address: ADDR_A }))
  const second = harness.run(() => useBalance({ address: ADDR_A }))

  expect(loadAccount).toHaveBeenCalledTimes(1)

  resolveLoad(accountFor(ADDR_A))
  await Promise.resolve()
  await Promise.resolve()

  expect(first.balance.value).toBe("100.0000000")
  expect(second.balance.value).toBe("100.0000000")

  harness.dispose()
})

test("scope disposal removes the query subscription", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  harness.run(() => useBalance({ address: ADDR_A }))
  await Promise.resolve()
  await Promise.resolve()

  const key = JSON.stringify(["account", "https://horizon-testnet.stellar.org", "testnet", ADDR_A])
  expect(harness.runtime.queryStore.subscriberCount(key)).toBe(1)

  harness.dispose()

  expect(harness.runtime.queryStore.subscriberCount(key)).toBe(0)
})

test("refetch() bypasses staleTime and re-fetches", async () => {
  const harness = createStellarTestHarness({ network: "testnet" })
  const { refetch } = harness.run(() => useBalance({ address: ADDR_A }))
  await Promise.resolve()
  await Promise.resolve()
  expect(loadAccount).toHaveBeenCalledTimes(1)

  refetch()
  await Promise.resolve()
  await Promise.resolve()
  expect(loadAccount).toHaveBeenCalledTimes(2)

  harness.dispose()
})

test("data, loading, and error are reactive", async () => {
  loadAccount.mockRejectedValueOnce(new Error("boom"))
  const harness = createStellarTestHarness({ network: "testnet" })
  const { error, loading } = harness.run(() => useBalance({ address: ADDR_A }))

  expect(loading.value).toBe(true)
  await Promise.resolve()
  await Promise.resolve()

  expect(loading.value).toBe(false)
  expect(error.value).toBeInstanceOf(Error)

  harness.dispose()
})
