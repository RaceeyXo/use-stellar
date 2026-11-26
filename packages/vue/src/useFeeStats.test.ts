import * as core from "use-stellar/core"
import { createStellarTestHarness } from "./test-utils"
import { useFeeStats } from "./useFeeStats"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchFeeStats: jest.fn(),
}))

const fetchFeeStats = core.fetchFeeStats as jest.MockedFunction<typeof core.fetchFeeStats>

function distribution(
  overrides: Partial<{
    max: string
    min: string
    mode: string
    p10: string
    p20: string
    p30: string
    p40: string
    p50: string
    p60: string
    p70: string
    p80: string
    p90: string
    p95: string
    p99: string
  }> = {}
) {
  return {
    max: "100",
    min: "100",
    mode: "100",
    p10: "100",
    p20: "100",
    p30: "100",
    p40: "100",
    p50: "100",
    p60: "100",
    p70: "100",
    p80: "100",
    p90: "100",
    p95: "100",
    p99: "100",
    ...overrides,
  }
}

function payload(charged: ReturnType<typeof distribution>, baseFee = "100") {
  return {
    last_ledger: "4367577",
    last_ledger_base_fee: baseFee,
    ledger_capacity_usage: "0.08",
    fee_charged: charged,
    max_fee: distribution({
      mode: "10000000",
      p50: "1000000",
      p90: "10026816",
      p99: "10158435",
    }),
  }
}

const quietCharged = distribution({
  p50: "13613",
  p90: "74042",
  p95: "211468",
  p99: "228438",
})

const surgeCharged = distribution({
  min: "100",
  mode: "5000",
  p10: "100",
  p50: "5001",
  p90: "5500",
  p95: "5500",
  p99: "5500",
})

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  fetchFeeStats.mockResolvedValue({
    baseFee: "100",
    mode: "100",
    percentiles: {
      p10: "100",
      p50: "13613",
      p90: "74042",
      p95: "211468",
      p99: "228438",
    },
  } as any)
})

test("fetches fee stats through the core query", async () => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeNull()
  expect(result.baseFee.value).toBe("100")
  expect(result.isSurging.value).toBe(false)
  expect(result.percentiles.value).toEqual({
    p10: "100",
    p50: "13613",
    p90: "74042",
    p95: "211468",
    p99: "228438",
  })
  expect(result.lastUpdated.value).toBeInstanceOf(Date)

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("suggested maps low/normal/high to p50/p90/p99 and defaults to normal", async () => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(result.suggested("low")).toBe("13613")
  expect(result.suggested("normal")).toBe("74042")
  expect(result.suggested()).toBe("74042")
  expect(result.suggested("high")).toBe("228438")
  expect(typeof result.suggested("high")).toBe("string")

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("suggested floors at baseFee", async () => {
  fetchFeeStats.mockResolvedValue({
    baseFee: "100",
    mode: "100",
    percentiles: {
      p10: "50",
      p50: "50",
      p90: "50",
      p95: "50",
      p99: "50",
    },
  } as any)

  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(result.suggested("low")).toBe("100")

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("isSurging is true when mode > baseFee", async () => {
  fetchFeeStats.mockResolvedValue({
    baseFee: "100",
    mode: "5000",
    percentiles: {
      p10: "100",
      p50: "5001",
      p90: "5500",
      p95: "5500",
      p99: "5500",
    },
  } as any)

  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(result.isSurging.value).toBe(true)

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("shares an in-flight request and releases subscriptions on disposal", async () => {
  let resolve!: () => void
  fetchFeeStats.mockReturnValueOnce(
    new Promise(done => {
      resolve = done
    }) as any
  )

  const harness = createStellarTestHarness()
  const first = harness.run(() => useFeeStats())
  const second = harness.run(() => useFeeStats())
  const key = core.feeStatsKey(
    harness.runtime.networkConfig.horizonUrl,
    harness.runtime.networkConfig.network
  )

  expect(fetchFeeStats).toHaveBeenCalledTimes(1)
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(2)

  resolve()
  await flush()
  expect(first.baseFee.value).toBe("100")
  expect(second.baseFee.value).toBe("100")

  harness.dispose()
  expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(0)
  harness.runtime.queryStore.clear()
})

test("handles errors and returns error state", async () => {
  fetchFeeStats.mockRejectedValueOnce(new Error("Horizon unavailable"))

  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(result.loading.value).toBe(false)
  expect(result.error.value).toBeInstanceOf(Error)
  expect(result.baseFee.value).toBe("")
  expect(result.isSurging.value).toBe(false)

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("suggested throws when stats have not loaded", async () => {
  fetchFeeStats.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(() => result.suggested("normal")).toThrow(
    "Fee stats have not loaded yet"
  )

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("preserves large stroop values", async () => {
  const huge = "9007199254740993"
  fetchFeeStats.mockResolvedValue({
    baseFee: "100",
    mode: "100",
    percentiles: {
      p10: huge,
      p50: huge,
      p90: huge,
      p95: huge,
      p99: huge,
    },
  } as any)

  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats())
  await flush()

  expect(result.percentiles.value.p99).toBe(huge)
  expect(result.suggested("high")).toBe(huge)

  harness.dispose()
  harness.runtime.queryStore.clear()
})

test("refetch bypasses cache freshness", async () => {
  const harness = createStellarTestHarness()
  const result = harness.run(() => useFeeStats({ staleTime: 60_000 } as any))
  await flush()

  expect(fetchFeeStats).toHaveBeenCalledTimes(1)

  await result.refetch()
  expect(fetchFeeStats).toHaveBeenCalledTimes(2)

  harness.dispose()
  harness.runtime.queryStore.clear()
})
