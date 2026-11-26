import { useCallback, useEffect, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { fetchFeeStats } from "../queries/feeStats"
import { createStellarError } from "../errors"
import type { FeeUrgency, StellarError, UseFeeStatsOptions, UseFeeStatsReturn } from "../types"
import type { ParsedFeeStats } from "../queries/feeStats"

const DEFAULT_WATCH_INTERVAL = 10_000
const MAX_INTERVAL_MS = 2_147_483_647

const EMPTY_PERCENTILES: UseFeeStatsReturn["percentiles"] = {
  p10: "",
  p50: "",
  p90: "",
  p95: "",
  p99: "",
}

function resolveInterval(interval: number | undefined): number {
  if (
    typeof interval !== "number" ||
    !Number.isFinite(interval) ||
    interval <= 0 ||
    interval > MAX_INTERVAL_MS
  ) {
    return DEFAULT_WATCH_INTERVAL
  }
  return interval
}

function maxStroop(left: string, right: string): string {
  return BigInt(left) >= BigInt(right) ? left : right
}

/**
 * Loads Horizon fee statistics for the active network.
 *
 * `isSurging` is true when `fee_charged.mode` is strictly greater than
 * `last_ledger_base_fee` (a 1-stroop gap). Quiet ledgers keep those equal.
 *
 * `suggested(urgency)` returns a **maximum bid** in stroops, not a charge.
 * The network only takes what the ledger needs, so a high bid does not
 * overpay on a quiet ledger. Mapping: low → p50, normal → p90, high → p99
 * of `fee_charged`.
 *
 * These numbers are Horizon inclusion fees. Soroban resource fees come from
 * simulation, not this endpoint.
 *
 * @example
 * const { isSurging, suggested, loading } = useFeeStats({ watch: true })
 */
export function useFeeStats({
  watch = false,
  interval = DEFAULT_WATCH_INTERVAL,
}: UseFeeStatsOptions = {}): UseFeeStatsReturn {
  const { networkConfig } = useStellarContext()
  const [stats, setStats] = useState<ParsedFeeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<StellarError | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const generationRef = useRef(0)
  const aliveRef = useRef(true)
  const loadRef = useRef<() => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    const id = ++generationRef.current
    setLoading(true)
    try {
      const parsed = await fetchFeeStats(networkConfig)
      if (!aliveRef.current || id !== generationRef.current) return
      setStats(parsed)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      if (!aliveRef.current || id !== generationRef.current) return
      setStats(null)
      setError((err as any) ?? createStellarError("UNKNOWN", "Fee stats request failed."))
    } finally {
      if (aliveRef.current && id === generationRef.current) {
        setLoading(false)
      }
    }
  }, [networkConfig])

  loadRef.current = load

  useEffect(() => {
    aliveRef.current = true
    void load()
    return () => {
      aliveRef.current = false
      generationRef.current += 1
    }
  }, [load])

  useEffect(() => {
    if (!watch) return
    const ms = resolveInterval(interval)
    const timer = setInterval(() => {
      void loadRef.current()
    }, ms)
    return () => clearInterval(timer)
  }, [watch, interval, networkConfig.horizonUrl])

  const refetch = useCallback(async () => {
    await load()
  }, [load])

  const suggested = useCallback(
    (urgency: FeeUrgency = "normal"): string => {
      if (!stats) {
        throw createStellarError(
          "VALIDATION_ERROR",
          "Fee stats have not loaded yet. Wait until loading is false before calling suggested()."
        )
      }
      if (urgency !== "low" && urgency !== "normal" && urgency !== "high") {
        throw createStellarError(
          "VALIDATION_ERROR",
          `Unknown fee urgency ${JSON.stringify(urgency)}. Use "low", "normal", or "high".`
        )
      }
      const percentile =
        urgency === "low"
          ? stats.percentiles.p50
          : urgency === "high"
            ? stats.percentiles.p99
            : stats.percentiles.p90
      return maxStroop(percentile, stats.baseFee)
    },
    [stats]
  )

  const isSurging = stats !== null && BigInt(stats.mode) > BigInt(stats.baseFee)

  return {
    baseFee: stats?.baseFee ?? "",
    percentiles: stats?.percentiles ?? EMPTY_PERCENTILES,
    isSurging,
    suggested,
    loading,
    error,
    lastUpdated,
    refetch,
  }
}
