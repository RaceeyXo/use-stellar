import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isValidStellarAddress } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, accountKey } from "../cache"
import type { UseAccountExistsOptions, UseAccountExistsReturn } from "../types"

/**
 * Checks whether a Stellar account exists on the ledger.
 *
 * Results are cached in the shared QueryStore and deduplicated with useAccount
 * and useBalance, since all three call loadAccount under the hood.
 *
 * @example
 * const { exists, reason } = useAccountExists({ address: "G..." })
 */
export function useAccountExists({
  address,
  staleTime,
}: UseAccountExistsOptions & { staleTime?: number } = {}): UseAccountExistsReturn {
  const { network, networkConfig, queryStore } = useStellarContext()

  // Validate format before hitting the network.
  const formatValid = !address || isValidStellarAddress(address)

  const queryKey =
    address && formatValid
      ? accountKey(networkConfig.horizonUrl, network, address)
      : (["accountExists", "disabled"] as const)

  const {
    data,
    loading,
    error: rawError,
    refetch,
  } = useQuery<{ exists: boolean; reason: UseAccountExistsReturn["reason"] }>({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      try {
        await server.loadAccount(address!)
        return { exists: true, reason: "exists" as const }
      } catch (err) {
        const stellarError = toStellarError(err)
        if (stellarError?.code === "ACCOUNT_NOT_FOUND") {
          return { exists: false, reason: "not_funded" as const }
        }
        throw stellarError ?? err
      }
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(address) && formatValid,
  })

  // Handle invalid format without touching the cache.
  if (address && !formatValid) {
    return {
      exists: false,
      reason: "invalid_format",
      loading: false,
      error: null,
      refetch,
    }
  }

  // No address → idle
  if (!address) {
    return {
      exists: null,
      reason: "idle",
      loading: false,
      error: null,
      refetch,
    }
  }

  const error = rawError ? toStellarError(rawError) : null

  return {
    exists: data?.exists ?? null,
    reason: data?.reason ?? "idle",
    loading,
    error,
    refetch,
  }
}
