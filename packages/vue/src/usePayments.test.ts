import { ref } from "vue"
import * as core from "use-stellar/core"
import { createStellarTestHarness } from "./test-utils"
import { usePayments } from "./usePayments"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchPaymentsPage: jest.fn(),
}))

const fetchPaymentsPage = core.fetchPaymentsPage as jest.MockedFunction<
  typeof core.fetchPaymentsPage
>
const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

function payment(id: string, direction: "incoming" | "outgoing"): core.NormalizedPayment {
  return {
    id,
    txHash: `tx-${id}`,
    type: "payment",
    from: direction === "incoming" ? ADDR_B : ADDR_A,
    to: direction === "incoming" ? ADDR_A : ADDR_B,
    amount: "1.0000000",
    asset: "XLM",
    direction,
    createdAt: "2026-01-01T00:00:00Z",
  }
}

function page(records = [payment("1", "incoming")]): core.PaymentsPageResult {
  return {
    records,
    nextCursor: jest.fn(),
    prevCursor: jest.fn(),
    hasNext: true,
    hasPrev: false,
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => fetchPaymentsPage.mockResolvedValue(page()))

test("resolves reactive inputs in the shared key and preserves normalized direction", async () => {
  const harness = createStellarTestHarness()
  const address = ref(ADDR_A)
  const limit = ref(20)
  const order = ref<"asc" | "desc">("asc")
  const cursor = ref<string | undefined>("start")
  const result = harness.run(() => usePayments({ address, limit, order, cursor }))
  await flush()

  expect(result.payments.value[0]?.direction).toBe("incoming")
  expect(fetchPaymentsPage).toHaveBeenLastCalledWith(harness.runtime.networkConfig, {
    address: ADDR_A,
    limit: 20,
    order: "asc",
    cursor: "start",
  })

  address.value = ADDR_B
  await flush()
  expect(fetchPaymentsPage).toHaveBeenLastCalledWith(harness.runtime.networkConfig, {
    address: ADDR_B,
    limit: 20,
    order: "asc",
    cursor: undefined,
  })
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("defaults to wallet address and becomes idle after disconnect", async () => {
  const harness = createStellarTestHarness({ walletAddress: ADDR_A })
  const result = harness.run(() => usePayments())
  await flush()
  expect(result.payments.value).toHaveLength(1)

  harness.runtime.setWalletAddress(null)
  await flush()
  expect(result.payments.value).toEqual([])
  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("navigates next and previous pages with React-compatible overfetch semantics", async () => {
  const rawIncoming = {
    id: "2",
    transaction_hash: "tx-2",
    created_at: "2026-01-02T00:00:00Z",
    type: "payment" as const,
    from: ADDR_B,
    to: ADDR_A,
    amount: "2.0000000",
    asset_type: "native" as const,
  }
  const rawOutgoing = { ...rawIncoming, id: "3", from: ADDR_A, to: ADDR_B }
  const previous = jest.fn(async () => ({
    records: [],
    next: jest.fn(),
    prev: jest.fn(),
  }))
  const next = jest.fn(async () => ({
    records: [rawIncoming, rawOutgoing],
    next: jest.fn(),
    prev: previous,
  }))
  fetchPaymentsPage.mockResolvedValueOnce({
    ...page(),
    nextCursor: next as unknown as core.PaymentsPageResult["nextCursor"],
  })
  const harness = createStellarTestHarness()
  const result = harness.run(() => usePayments({ address: ADDR_A, limit: 1 }))
  await flush()

  await result.fetchNext()
  expect(result.payments.value.map(item => item.id)).toEqual(["2"])
  expect(result.payments.value[0]?.direction).toBe("incoming")
  expect(result.hasNext.value).toBe(true)
  expect(result.hasPrev.value).toBe(true)

  await result.fetchPrev()
  expect(result.payments.value.map(item => item.id)).toEqual(["2"])
  expect(result.hasPrev.value).toBe(false)
  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("empty input is idle and two callers deduplicate the first page", async () => {
  const harness = createStellarTestHarness()
  const idle = harness.run(() => usePayments({ address: "" }))
  expect(idle.loading.value).toBe(false)
  expect(fetchPaymentsPage).not.toHaveBeenCalled()

  let resolve!: (value: core.PaymentsPageResult) => void
  fetchPaymentsPage.mockReturnValueOnce(new Promise(done => (resolve = done)))
  const first = harness.run(() => usePayments({ address: ADDR_A }))
  const second = harness.run(() => usePayments({ address: ADDR_A }))
  expect(fetchPaymentsPage).toHaveBeenCalledTimes(1)
  resolve(page())
  await flush()
  expect(first.payments.value).toEqual(second.payments.value)
  harness.dispose()
  harness.runtime.queryStore.clear()
})
