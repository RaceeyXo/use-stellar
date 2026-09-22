import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, parseHorizonBalance } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, accountKey } from "../cache"
import type { AccountInfo, StellarError } from "../types"

export interface UseAccountOptions {
  address?: string | null // defaults to connected wallet address
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

export interface UseAccountReturn {
  account: AccountInfo | null
  loading: boolean
  error: StellarError | null
  /**
   * `true` when `error` is set but `account` still holds data from a
   * previous successful fetch (stale-while-revalidate). `false` once a
   * fetch succeeds again, or when there is no data to be stale.
   */
  isStale: boolean
  refetch: () => void
}

/**
 * Fetches account information including balances, sequence number, and signers.
 *
 * Results are cached in the shared QueryStore and deduplicated: two components
 * calling useAccount for the same address issue exactly one network request.
 *
 * Follows a stale-while-revalidate contract: a failed fetch never clears
 * `account` — it only sets `error` and flips `isStale` to `true`, so the
 * consumer can keep rendering the last known-good account info instead of
 * nothing.
 *
 * @param options - Configuration options
 * @param options.address - The Stellar address to fetch. Defaults to the connected wallet.
 * @param options.staleTime - Override the provider-level staleTime for this hook.
 * @returns `{ account, loading, error, isStale, refetch }`
 *
 * @example
 * const { account, loading, isStale } = useAccount({ address: "G..." })
 */
export function useAccount({
  address,
  staleTime,
  maxRetries,
}: UseAccountOptions = {}): UseAccountReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKey = resolvedAddress
    ? accountKey(networkConfig.horizonUrl, network, resolvedAddress)
    : (["account", "disabled"] as const)

  const {
    data: account,
    loading,
    error: rawError,
    refetch,
  } = useQuery<AccountInfo>({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      const raw = await server.loadAccount(resolvedAddress!)

      return {
        address: raw.id,
        sequence: raw.sequenceNumber(),
        balances: raw.balances.map(parseHorizonBalance),
        subentryCount: raw.subentry_count,
        thresholds: {
          lowThreshold: raw.thresholds.low_threshold,
          medThreshold: raw.thresholds.med_threshold,
          highThreshold: raw.thresholds.high_threshold,
        },
        signers: raw.signers.map((s: { key: string; weight: number; type: string }) => ({
          key: s.key,
          weight: s.weight,
          type: s.type,
        })),
      } satisfies AccountInfo
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(resolvedAddress),
    maxRetries,
  })

  const error = rawError ? toStellarError(rawError) : null

  // Stale-while-revalidate: `account` still holds the previous good result
  // while `error` is set, so a consumer can tell "old data" from "no data".
  const isStale = error !== null && account !== null

  return { account, loading, error, isStale, refetch }
}
