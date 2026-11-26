import { getHorizonServer } from "../utils"
import { createStellarError, toStellarError } from "../errors"
import type { NetworkConfig } from "../types"

const INT64_MAX = 9223372036854775807n
const STROOP_RE = /^\d+$/

export interface ParsedFeeStats {
  baseFee: string
  mode: string
  percentiles: {
    p10: string
    p50: string
    p90: string
    p95: string
    p99: string
  }
}

/**
 * Query key builder for fee stats.
 *
 * Fee stats are network-wide and change every ledger, so they key on
 * horizonUrl and network. No per-account dimensions.
 */
export function feeStatsKey(horizonUrl: string, network: string): readonly unknown[] {
  return ["feeStats", horizonUrl, network] as const
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
 * Fetches Horizon fee statistics for the active network.
 *
 * Framework-neutral: no React/Vue imports, no cache access. Errors are mapped
 * through `toStellarError` so both frameworks surface identical codes.
 */
export async function fetchFeeStats(
  networkConfig: NetworkConfig,
  options: { signal?: AbortSignal } = {}
): Promise<ParsedFeeStats> {
  try {
    const server = getHorizonServer(networkConfig)
    const raw = await server.feeStats()
    if (options.signal?.aborted) throw new Error("Aborted")
    return parseFeeStats(raw)
  } catch (err) {
    if (options.signal?.aborted) throw err
    const stellarError = toStellarError(err)
    throw stellarError ?? err
  }
}
