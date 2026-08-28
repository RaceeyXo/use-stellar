import { useEffect, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, parseHorizonBalance } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, accountKey } from "../cache"
import type { Asset, Balance, StellarError } from "../types"

export interface UseBalanceOptions {
  address?: string | null // defaults to connected wallet address
  asset?: Asset // defaults to XLM
  watch?: boolean // auto re-fetch on an interval (default false)
  interval?: number // polling interval in ms when watch is true (default 10000)
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

export interface UseBalanceReturn {
  balance: string | null
  balances: Balance[]
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null // timestamp of the last successful fetch
  refetch: () => void
}

// Default polling interval (ms) used when `watch` is enabled without an explicit
// `interval`.
const DEFAULT_WATCH_INTERVAL = 10_000

/**
 * Fetches the XLM or asset balance for the connected wallet or any Stellar address.
 *
 * Results are cached in the shared QueryStore and deduplicated: two components
 * calling useBalance for the same address issue exactly one network request.
 *
 * When the Horizon rate-limit (HTTP 429) is hit, `retryWithBackoff` is called
 * automatically and the polling interval is paused until the retry window
 * expires — preventing the client from hammering Horizon while blocked.
 *
 * @param options - Configuration options
 * @param options.address - The Stellar address to fetch balances for. Defaults to the connected wallet.
 * @param options.asset - The asset to return in `balance`. Defaults to XLM.
 * @param options.watch - When true, re-fetches on an interval (default false).
 * @param options.interval - Polling interval in ms when `watch` is true (default 10000).
 * @param options.staleTime - Override the provider-level staleTime for this hook.
 * @param options.maxRetries - Max automatic retries on retriable failures (default 3).
 * @returns `{ balance, balances, loading, error, lastUpdated, refetch }`
 *
 * @example
 * const { balance, loading } = useBalance({ asset: "XLM", watch: true, interval: 5000 })
 */
export function useBalance({
  address,
  asset = "XLM",
  watch = false,
  interval = DEFAULT_WATCH_INTERVAL,
  staleTime,
  maxRetries,
}: UseBalanceOptions = {}): UseBalanceReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKey = resolvedAddress
    ? accountKey(networkConfig.horizonUrl, network, resolvedAddress)
    : (["balance", "disabled"] as const)

  const {
    data: balances,
    loading,
    error: rawError,
    updatedAt,
    refetch,
    rateLimitedUntilRef,
  } = useQuery<Balance[]>({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      const account = await server.loadAccount(resolvedAddress!)
      return account.balances.map(parseHorizonBalance)
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(resolvedAddress),
    maxRetries,
  })

  // Keep a stable ref so the interval doesn't close over a stale refetch.
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  // Polling: when watch is enabled, call refetch() on the interval.
  // If a 429 rate-limit window is still active, we skip the poll cycle
  // instead of hammering Horizon while blocked.
  useEffect(() => {
    if (!watch || !resolvedAddress) return

    const ms = interval > 0 ? interval : DEFAULT_WATCH_INTERVAL
    const id = setInterval(() => {
      // Skip this poll cycle if the rate-limit backoff window hasn't expired.
      if (rateLimitedUntilRef.current !== null && Date.now() < rateLimitedUntilRef.current) {
        return
      }
      refetchRef.current()
    }, ms)
    return () => clearInterval(id)
  }, [watch, interval, resolvedAddress, network, networkConfig.horizonUrl, rateLimitedUntilRef])

  const error = rawError ? toStellarError(rawError) : null
  const lastUpdated = updatedAt ? new Date(updatedAt) : null

  const match = (balances ?? []).find(b => {
    if (asset === "XLM") return b.asset === "XLM"
    if (typeof asset === "object" && typeof b.asset === "object") {
      return b.asset.code === asset.code && b.asset.issuer === asset.issuer
    }
    return false
  })
  const balance = match?.balance ?? null

  return {
    balance,
    balances: balances ?? [],
    loading,
    error,
    lastUpdated,
    refetch,
  }
}
