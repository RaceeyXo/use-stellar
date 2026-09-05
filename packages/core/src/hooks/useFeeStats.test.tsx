import React from "react"
import { renderHook, act } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { StellarError } from "../errors"
import { useFeeStats } from "./useFeeStats"

jest.mock("../utils", () => ({
  getHorizonServer: jest.fn(),
}))

import { getHorizonServer } from "../utils"

const mockGetServer = getHorizonServer as jest.Mock
const feeStats = jest.fn()

function wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

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

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  feeStats.mockReset()
  feeStats.mockResolvedValue(payload(quietCharged))
  mockGetServer.mockReturnValue({ feeStats })
})

afterEach(() => {
  jest.useRealTimers()
})

test("quiet network: mode equals last_ledger_base_fee so isSurging is false", async () => {
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBeNull()
  expect(result.current.baseFee).toBe("100")
  expect(result.current.isSurging).toBe(false)
  expect(result.current.percentiles).toEqual({
    p10: "100",
    p50: "13613",
    p90: "74042",
    p95: "211468",
    p99: "228438",
  })
  expect(result.current.lastUpdated).toBeInstanceOf(Date)
})

test("surging network: mode above last_ledger_base_fee so isSurging is true", async () => {
  feeStats.mockResolvedValue(payload(surgeCharged))
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.isSurging).toBe(true)
  expect(result.current.baseFee).toBe("100")
})

test("suggested maps low/normal/high to charged p50/p90/p99 and defaults to normal", async () => {
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.suggested("low")).toBe("13613")
  expect(result.current.suggested("normal")).toBe("74042")
  expect(result.current.suggested()).toBe("74042")
  expect(result.current.suggested("high")).toBe("228438")
  expect(typeof result.current.suggested("high")).toBe("string")
})

test("suggested never uses max_fee percentiles", async () => {
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.suggested("low")).not.toBe("1000000")
  expect(result.current.suggested("high")).not.toBe("10158435")
})

test("suggested floors at last_ledger_base_fee", async () => {
  feeStats.mockResolvedValue(
    payload(
      distribution({
        mode: "100",
        p50: "50",
        p90: "50",
        p99: "50",
      })
    )
  )
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.suggested("low")).toBe("100")
})

test("keeps stroop values that do not fit in Number.MAX_SAFE_INTEGER", async () => {
  const huge = "9007199254740993"
  feeStats.mockResolvedValue(
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
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.percentiles.p99).toBe(huge)
  expect(result.current.suggested("high")).toBe(huge)
})

test("failed feeStats surfaces a StellarError and does not throw from render", async () => {
  feeStats.mockRejectedValue(new Error("horizon unreachable"))
  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()

  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBeInstanceOf(StellarError)
  expect(result.current.baseFee).toBe("")
  expect(result.current.isSurging).toBe(false)
  expect(() => result.current.suggested("normal")).toThrow(StellarError)
})

test("watch: false (default) fetches once and never sets an interval", async () => {
  renderHook(() => useFeeStats(), { wrapper })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(1)

  await act(async () => {
    jest.advanceTimersByTime(60_000)
  })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(1)
})

test("watch: true re-fetches every 10 seconds by default", async () => {
  renderHook(() => useFeeStats({ watch: true }), { wrapper })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(1)

  await act(async () => {
    jest.advanceTimersByTime(10_000)
  })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(2)
})

test("watch: true with interval: 5000 re-fetches every 5 seconds", async () => {
  renderHook(() => useFeeStats({ watch: true, interval: 5_000 }), { wrapper })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(1)

  await act(async () => {
    jest.advanceTimersByTime(5_000)
  })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(2)

  await act(async () => {
    jest.advanceTimersByTime(4_999)
  })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(2)
})

test("clears the interval on unmount (no further fetches)", async () => {
  const clearSpy = jest.spyOn(global, "clearInterval")
  const { unmount } = renderHook(() => useFeeStats({ watch: true }), { wrapper })
  await flush()

  unmount()
  expect(clearSpy).toHaveBeenCalled()

  const callsBefore = feeStats.mock.calls.length
  await act(async () => {
    jest.advanceTimersByTime(30_000)
  })
  await flush()
  expect(feeStats).toHaveBeenCalledTimes(callsBefore)

  clearSpy.mockRestore()
})

test("ignores a slower first response after a newer fetch has settled", async () => {
  let resolveFirst: (value: ReturnType<typeof payload>) => void = () => {
    throw new Error("resolveFirst not set")
  }
  feeStats.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveFirst = resolve
      })
  )
  feeStats.mockResolvedValueOnce(payload(surgeCharged))

  const { result } = renderHook(() => useFeeStats(), { wrapper })
  await flush()
  expect(result.current.loading).toBe(true)

  await act(async () => {
    await result.current.refetch()
  })
  await flush()
  expect(result.current.isSurging).toBe(true)
  expect(result.current.baseFee).toBe("100")

  await act(async () => {
    resolveFirst(payload(quietCharged))
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(result.current.isSurging).toBe(true)
  expect(result.current.percentiles.p90).toBe("5500")
})

test("does not apply a late response after unmount", async () => {
  let resolveLate: (value: ReturnType<typeof payload>) => void = () => {
    throw new Error("resolveLate not set")
  }
  feeStats.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveLate = resolve
      })
  )

  const { unmount } = renderHook(() => useFeeStats(), { wrapper })
  await flush()
  unmount()

  await act(async () => {
    resolveLate(payload(surgeCharged))
    await Promise.resolve()
  })
})
