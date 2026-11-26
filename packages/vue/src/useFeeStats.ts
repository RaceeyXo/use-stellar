import { computed, ref, type ComputedRef } from "vue"
import {
  feeStatsKey,
  fetchFeeStats,
  type FeeUrgency,
  type StellarError,
  type UseFeeStatsOptions,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export type { UseFeeStatsOptions, FeeUrgency } from "use-stellar/core"

export interface UseFeeStatsReturn {
  baseFee: ComputedRef<string>
  percentiles: ComputedRef<{
    p10: string
    p50: string
    p90: string
    p95: string
    p99: string
  }>
  isSurging: ComputedRef<boolean>
  suggested: (urgency?: FeeUrgency) => string
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  lastUpdated: ComputedRef<Date | null>
  refetch: () => Promise<void>
}

const EMPTY_PERCENTILES: {
  p10: string
  p50: string
  p90: string
  p95: string
  p99: string
} = {
  p10: "",
  p50: "",
  p90: "",
  p95: "",
  p99: "",
}

/**
 * Loads Horizon fee statistics for the active network through the shared Vue cache.
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
export function useFeeStats(options: UseFeeStatsOptions = {}): UseFeeStatsReturn {
  const runtime = useStellarRuntime()

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      feeStatsKey(runtime.networkConfig.horizonUrl, runtime.networkConfig.network),
    queryFn: () => fetchFeeStats(runtime.networkConfig),
  })

  const stats = computed(() => query.data.value)
  const suggestedRef = ref<(urgency?: FeeUrgency) => string>(() => {
    throw new Error("Fee stats not loaded")
  })

  // Update suggested function whenever stats change
  computed(() => {
    if (!stats.value) {
      suggestedRef.value = (urgency?: FeeUrgency) => {
        throw new Error(
          "Fee stats have not loaded yet. Wait until loading is false before calling suggested()."
        )
      }
    } else {
      const parsedStats = stats.value
      suggestedRef.value = (urgency: FeeUrgency = "normal") => {
        if (urgency !== "low" && urgency !== "normal" && urgency !== "high") {
          throw new Error(
            `Unknown fee urgency ${JSON.stringify(urgency)}. Use "low", "normal", or "high".`
          )
        }
        const percentile =
          urgency === "low"
            ? parsedStats.percentiles.p50
            : urgency === "high"
              ? parsedStats.percentiles.p99
              : parsedStats.percentiles.p90
        return BigInt(percentile) >= BigInt(parsedStats.baseFee) ? percentile : parsedStats.baseFee
      }
    }
  })

  return {
    baseFee: computed(() => stats.value?.baseFee ?? ""),
    percentiles: computed(() => stats.value?.percentiles ?? EMPTY_PERCENTILES),
    isSurging: computed(() => {
      if (!stats.value) return false
      return BigInt(stats.value.mode) > BigInt(stats.value.baseFee)
    }),
    suggested: (urgency?: FeeUrgency) => suggestedRef.value(urgency),
    loading: computed(() => query.loading.value),
    error: computed(() => query.error.value as StellarError | null),
    lastUpdated: computed(() => {
      if (query.updatedAt.value === null) return null
      return new Date(query.updatedAt.value)
    }),
    refetch: query.refetch,
  }
}
