import { computed, ref, shallowRef } from "vue"
import type { NormalizedPayment } from "use-stellar/core"
import { createStellarTestHarness } from "./test-utils"
import { usePaymentHistory } from "./usePaymentHistory"
import { usePayments } from "./usePayments"

jest.mock("./usePayments", () => ({ usePayments: jest.fn() }))

const mockUsePayments = usePayments as jest.MockedFunction<typeof usePayments>
const ISSUER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const source = shallowRef<NormalizedPayment[]>([
  {
    id: "xlm-in",
    txHash: "tx-1",
    type: "payment",
    from: "GSENDER",
    to: "GVIEWER",
    amount: "1",
    asset: "XLM",
    direction: "incoming",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "usd-out",
    txHash: "tx-2",
    type: "payment",
    from: "GVIEWER",
    to: "GRECEIVER",
    amount: "2",
    asset: { code: "USD", issuer: ISSUER },
    direction: "outgoing",
    createdAt: "2026-01-02T00:00:00Z",
  },
])

const fetchNext = jest.fn(async () => {})
const fetchPrev = jest.fn(async () => {})
const refetch = jest.fn(async () => {})

beforeEach(() => {
  mockUsePayments.mockReturnValue({
    payments: computed(() => source.value),
    loading: computed(() => false),
    error: computed(() => null),
    isStale: computed(() => false),
    refetch,
    fetchNext,
    fetchPrev,
    hasNext: computed(() => true),
    hasPrev: computed(() => false),
  })
})

test("composes usePayments once and filters reactively without refetching", () => {
  const harness = createStellarTestHarness()
  const direction = ref<"incoming" | "outgoing" | "all">("incoming")
  const asset = ref<"XLM" | "all">("all")
  const result = harness.run(() =>
    usePaymentHistory({ address: "GVIEWER", direction, asset, limit: 10 })
  )

  expect(mockUsePayments).toHaveBeenCalledTimes(1)
  expect(result.payments.value.map(payment => payment.id)).toEqual(["xlm-in"])

  direction.value = "all"
  asset.value = "XLM"
  expect(result.payments.value.map(payment => payment.id)).toEqual(["xlm-in"])
  expect(mockUsePayments).toHaveBeenCalledTimes(1)
  expect(refetch).not.toHaveBeenCalled()
  harness.dispose()
})

test("distinguishes native XLM from an issued asset and forwards paging", async () => {
  const harness = createStellarTestHarness()
  const result = harness.run(() =>
    usePaymentHistory({
      direction: () => "outgoing",
      asset: () => ({ code: "USD", issuer: ISSUER }),
    })
  )

  expect(result.payments.value.map(payment => payment.id)).toEqual(["usd-out"])
  expect(result.hasNext.value).toBe(true)
  await result.fetchNext()
  await result.fetchPrev()
  await result.refetch()
  expect(fetchNext).toHaveBeenCalledTimes(1)
  expect(fetchPrev).toHaveBeenCalledTimes(1)
  expect(refetch).toHaveBeenCalledTimes(1)
  harness.dispose()
})

test("filters only the currently projected page", () => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => usePaymentHistory({ direction: "incoming" }))
  expect(result.payments.value.map(payment => payment.id)).toEqual(["xlm-in"])

  source.value = [
    { ...source.value[1]!, id: "page-two-out" },
    { ...source.value[0]!, id: "page-two-in" },
  ]
  expect(result.payments.value.map(payment => payment.id)).toEqual(["page-two-in"])
  harness.dispose()
})
