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
  refetch: () => void
}

/**
 * Fetches claimable balances for an address.
 *
 * Results are cached in the shared QueryStore and deduplicated.
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

  return { balances: data ?? [], loading, error, refetch }
}
