import { useCallback, useEffect, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { createStellarError, toStellarError } from "../errors"
import type { FeeUrgency, StellarError, UseFeeStatsOptions, UseFeeStatsReturn } from "../types"

const DEFAULT_WATCH_INTERVAL = 10_000
const MAX_INTERVAL_MS = 2_147_483_647
const INT64_MAX = 9223372036854775807n
const STROOP_RE = /^\d+$/

const EMPTY_PERCENTILES: UseFeeStatsReturn["percentiles"] = {
  p10: "",
  p50: "",
  p90: "",
  p95: "",
  p99: "",
}

interface ParsedFeeStats {
  baseFee: string
  mode: string
  percentiles: UseFeeStatsReturn["percentiles"]
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

function assertStroopString(value: unknown, field: string): string {
  if (typeof value !== "string" || !STROOP_RE.test(value)) {
    throw createStellarError(
      "VALIDATION_ERROR",
      `Horizon fee_stats field ${field} is not a stroop integer string.`
    )
  }
  if (BigInt(value) > INT64_MAX) {
    throw createStellarError(
      "VALIDATION_ERROR",
      `Horizon fee_stats field ${field} exceeds the signed int64 range.`
    )
  }
  return value
}

function maxStroop(left: string, right: string): string {
  return BigInt(left) >= BigInt(right) ? left : right
}

function parseFeeStats(raw: unknown): ParsedFeeStats {
  if (raw === null || typeof raw !== "object") {
    throw createStellarError("VALIDATION_ERROR", "Horizon fee_stats returned a non-object payload.")
  }

  const body = raw as {
    last_ledger_base_fee?: unknown
    fee_charged?: {
      mode?: unknown
      p10?: unknown
      p50?: unknown
      p90?: unknown
      p95?: unknown
      p99?: unknown
    }
  }

  const charged = body.fee_charged
  if (charged === null || typeof charged !== "object") {
    throw createStellarError("VALIDATION_ERROR", "Horizon fee_stats is missing fee_charged.")
  }

  const baseFee = assertStroopString(body.last_ledger_base_fee, "last_ledger_base_fee")
  const mode = assertStroopString(charged.mode, "fee_charged.mode")

  return {
    baseFee,
    mode,
    percentiles: {
      p10: assertStroopString(charged.p10, "fee_charged.p10"),
      p50: assertStroopString(charged.p50, "fee_charged.p50"),
      p90: assertStroopString(charged.p90, "fee_charged.p90"),
      p95: assertStroopString(charged.p95, "fee_charged.p95"),
      p99: assertStroopString(charged.p99, "fee_charged.p99"),
    },
  }
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
      const server = getHorizonServer(networkConfig)
      const raw = await server.feeStats()
      if (!aliveRef.current || id !== generationRef.current) return
      const parsed = parseFeeStats(raw)
      setStats(parsed)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      if (!aliveRef.current || id !== generationRef.current) return
      setStats(null)
      setError(toStellarError(err) ?? createStellarError("UNKNOWN", "Fee stats request failed."))
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
