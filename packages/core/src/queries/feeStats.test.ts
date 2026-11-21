import { fetchFeeStats, feeStatsKey } from "./feeStats"
import { createStellarError } from "../errors"

jest.mock("../utils", () => ({
  getHorizonServer: jest.fn(),
}))

import { getHorizonServer } from "../utils"
import { NETWORK_CONFIGS } from "../types"

const mockGetServer = getHorizonServer as jest.Mock
const mockFeeStats = jest.fn()

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

beforeEach(() => {
  mockFeeStats.mockReset()
  mockFeeStats.mockResolvedValue(payload(quietCharged))
  mockGetServer.mockReturnValue({ feeStats: mockFeeStats })
})

test("feeStatsKey returns correct query key", () => {
  const key = feeStatsKey("https://horizon-testnet.stellar.org", "testnet")
  expect(key).toEqual(["feeStats", "https://horizon-testnet.stellar.org", "testnet"])
})

test("fetchFeeStats parses a valid quiet network payload", async () => {
  const result = await fetchFeeStats(NETWORK_CONFIGS.testnet)

  expect(result).toEqual({
    baseFee: "100",
    mode: "100",
    percentiles: {
      p10: "100",
      p50: "13613",
      p90: "74042",
      p95: "211468",
      p99: "228438",
    },
  })
})

test("fetchFeeStats parses a surging network payload", async () => {
  const surgeCharged = distribution({
    min: "100",
    mode: "5000",
    p10: "100",
    p50: "5001",
    p90: "5500",
    p95: "5500",
    p99: "5500",
  })
  mockFeeStats.mockResolvedValue(payload(surgeCharged))

  const result = await fetchFeeStats(NETWORK_CONFIGS.testnet)

  expect(result.baseFee).toBe("100")
  expect(result.mode).toBe("5000")
})

test("preserves large stroop values that exceed Number.MAX_SAFE_INTEGER", async () => {
  const huge = "9007199254740993"
  mockFeeStats.mockResolvedValue(
    payload(
      distribution({
        mode: "100",
        p10: huge,
        p50: huge,
        p90: huge,
        p95: huge,
        p99: huge,
      })
    )
  )

  const result = await fetchFeeStats(NETWORK_CONFIGS.testnet)

  expect(result.percentiles.p99).toBe(huge)
  expect(typeof result.percentiles.p99).toBe("string")
})

test("rejects a non-object payload", async () => {
  mockFeeStats.mockResolvedValue(null)

  await expect(fetchFeeStats(NETWORK_CONFIGS.testnet)).rejects.toThrow()
})

test("rejects missing fee_charged", async () => {
  mockFeeStats.mockResolvedValue({
    last_ledger_base_fee: "100",
  })

  await expect(fetchFeeStats(NETWORK_CONFIGS.testnet)).rejects.toThrow()
})

test("rejects non-stroop strings", async () => {
  mockFeeStats.mockResolvedValue(
    payload(distribution({ p50: "not_a_number" }))
  )

  await expect(fetchFeeStats(NETWORK_CONFIGS.testnet)).rejects.toThrow()
})

test("rejects stroop values exceeding int64 range", async () => {
  mockFeeStats.mockResolvedValue(
    payload(distribution({ p50: "9223372036854775808" }))
  )

  await expect(fetchFeeStats(NETWORK_CONFIGS.testnet)).rejects.toThrow()
})

test("handles network errors through toStellarError", async () => {
  mockFeeStats.mockRejectedValue(new Error("Horizon unreachable"))

  await expect(fetchFeeStats(NETWORK_CONFIGS.testnet)).rejects.toThrow()
})

test("respects AbortSignal", async () => {
  const controller = new AbortController()
  mockFeeStats.mockImplementation(
    () => new Promise(resolve => setTimeout(() => resolve(payload(quietCharged)), 1000))
  )

  const promise = fetchFeeStats(NETWORK_CONFIGS.testnet, { signal: controller.signal })
  controller.abort()

  await expect(promise).rejects.toThrow()
})
