import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, claimableBalanceKey } from "../cache"
import type { ClaimableBalance, StellarError } from "../types"

export interface UseClaimableBalanceOptions {
  address?: string | null // defaults to connected wallet address
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

export interface UseClaimableBalanceReturn {
  balances: ClaimableBalance[]
  loading: boolean
  error: StellarError | null
  /**
   * `true` when `error` is set but `balances` still holds data from a
   * previous successful fetch (stale-while-revalidate). `false` once a
   * fetch succeeds again, or when there is no data to be stale.
   */
  isStale: boolean
  refetch: () => void
}

/**
 * Fetches claimable balances for the connected wallet or any Stellar address.
 *
 * Results are cached in the shared QueryStore and deduplicated across hook
 * instances that ask for the same address.
 *
 * Follows a stale-while-revalidate contract: a failed fetch never clears
 * `balances` — it only sets `error` and flips `isStale` to `true`, so the
 * consumer can keep rendering the last known-good balances instead of
 * nothing. Horizon reporting no claimable balances (a 404) is a legitimately
 * empty result rather than a failure, and yields an empty list.
 *
 * @example
 * const { balances } = useClaimableBalance({ address: "G..." })
 */
export function useClaimableBalance({
  address,
  staleTime,
  maxRetries,
}: UseClaimableBalanceOptions = {}): UseClaimableBalanceReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKey = resolvedAddress
    ? claimableBalanceKey(networkConfig.horizonUrl, network, resolvedAddress)
    : (["claimableBalance", "disabled"] as const)

  const {
    data,
    loading,
    error: rawError,
    refetch,
  } = useQuery<ClaimableBalance[]>({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      try {
        const result = await server.claimableBalances().claimant(resolvedAddress!).call()
        return result.records.map(record => ({
          id: record.id,
          asset: record.asset,
          amount: record.amount,
          claimants: record.claimants.map(c => ({
            destination: c.destination,
            predicate: c.predicate as object,
          })),
          sponsor: record.sponsor,
        }))
      } catch (err) {
        const stellarError = toStellarError(err)
        // A 404 means the account has no claimable balances — treat as empty
        if (stellarError?.code === "ACCOUNT_NOT_FOUND") {
          return []
        }
        throw stellarError ?? err
      }
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(resolvedAddress),
    maxRetries,
  })

  const error = rawError ? toStellarError(rawError) : null
  const balances = data ?? []

  // Stale-while-revalidate: `balances` still holds the previous good result
  // while `error` is set, so a consumer can tell "old data" from "no data".
  const isStale = error !== null && balances.length > 0

  return { balances, loading, error, isStale, refetch }
}
