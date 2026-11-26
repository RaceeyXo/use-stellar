import { mockHorizonServer } from "@stellar/stellar-sdk"
import { useFeeStats } from "../index"
import { act, renderHookWithStellar, setAppState, setOnline, waitFor } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

/** Horizon `/fee_stats` payload; stroop strings, testnet-shaped. */
function feeStatsPayload(overrides: { mode?: string; baseFee?: string } = {}) {
  return {
    last_ledger: "12345",
    last_ledger_base_fee: overrides.baseFee ?? "100",
    ledger_capacity_usage: "0.5",
    fee_charged: {
      max: "1000",
      min: "100",
      mode: overrides.mode ?? "100",
      p10: "100",
      p50: "100",
      p90: "200",
      p95: "300",
      p99: "500",
    },
  }
}

describe("useFeeStats on React Native", () => {
  beforeEach(() => {
    mockHorizonServer.feeStats.mockReset().mockResolvedValue(feeStatsPayload())
  })

  it("loads fee stats without window, document or react-dom", async () => {
    assertNoDomGlobals()

    const { result, unmount } = renderHookWithStellar(() => useFeeStats())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.baseFee).toBe("100")
    expect(result.current.percentiles).toEqual({
      p10: "100",
      p50: "100",
      p90: "200",
      p95: "300",
      p99: "500",
    })
    expect(result.current.isSurging).toBe(false)
    expect(result.current.suggested("low")).toBe("100")
    expect(result.current.suggested("normal")).toBe("200")
    expect(result.current.suggested("high")).toBe("500")
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
    expect(mockHorizonServer.feeStats).toHaveBeenCalledTimes(1)
    unmount()
  })

  it("reports surge pricing when the mode fee exceeds the base fee", async () => {
    mockHorizonServer.feeStats.mockResolvedValue(feeStatsPayload({ mode: "250" }))

    const { result, unmount } = renderHookWithStellar(() => useFeeStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isSurging).toBe(true)
    unmount()
  })

  it("refetch() after the app returns to the foreground loads fresh stats", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFeeStats())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isSurging).toBe(false)

    act(() => setAppState("background"))
    mockHorizonServer.feeStats.mockResolvedValue(feeStatsPayload({ mode: "300" }))
    act(() => setAppState("active"))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.isSurging).toBe(true)
    expect(mockHorizonServer.feeStats).toHaveBeenCalledTimes(2)
    unmount()
  })

  // Desired native behaviour, per the issue: no polling while backgrounded and one
  // catch-up fetch on return. `useFeeStats` has no `focusManager` wiring (unlike
  // `useBalance` / `usePaymentPaths`), so its `watch` timer keeps firing in the
  // background and nothing refetches on foreground. `it.failing` passes while that
  // is true and starts failing, prompting removal of the marker, once it is fixed.
  it.failing("pauses watch polling in the background and refetches once on return", async () => {
    const { result, unmount } = renderHookWithStellar(() =>
      useFeeStats({ watch: true, interval: 5_000 })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockHorizonServer.feeStats).toHaveBeenCalledTimes(1)

    act(() => setAppState("background"))
    await act(async () => {
      jest.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(mockHorizonServer.feeStats).toHaveBeenCalledTimes(1)

    act(() => setAppState("active"))
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockHorizonServer.feeStats).toHaveBeenCalledTimes(2)
    unmount()
  })

  // Likewise `useFeeStats` does not consult `onlineManager`, so a watch tick while
  // NetInfo reports offline still calls Horizon.
  it.failing("starts no request while NetInfo reports offline", async () => {
    const { result, unmount } = renderHookWithStellar(() =>
      useFeeStats({ watch: true, interval: 5_000 })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => setOnline(false))
    await act(async () => {
      jest.advanceTimersByTime(30_000)
      await Promise.resolve()
    })

    expect(mockHorizonServer.feeStats).toHaveBeenCalledTimes(1)
    unmount()
  })

  it("surfaces a network failure as a StellarError and keeps refetch usable", async () => {
    mockHorizonServer.feeStats.mockRejectedValue(new Error("Network Error"))

    const { result, unmount } = renderHookWithStellar(() => useFeeStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).not.toBeNull()
    expect(typeof result.current.error?.code).toBe("string")
    expect(result.current.baseFee).toBe("")
    expect(() => result.current.suggested()).toThrow(/not loaded/)

    mockHorizonServer.feeStats.mockResolvedValue(feeStatsPayload())
    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.baseFee).toBe("100")
    unmount()
  })

  it("rejects a malformed payload with VALIDATION_ERROR", async () => {
    mockHorizonServer.feeStats.mockResolvedValue({ last_ledger_base_fee: "abc", fee_charged: {} })

    const { result, unmount } = renderHookWithStellar(() => useFeeStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    unmount()
  })
})
