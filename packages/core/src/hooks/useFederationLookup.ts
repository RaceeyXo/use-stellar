import { Federation } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import { useStellarContext } from "../context/StellarProvider"
import { useQuery, federationKey } from "../cache"
import type {
  FederationRecord,
  UseFederationLookupOptions,
  UseFederationLookupReturn,
  StellarError,
} from "../types"

const FEDERATION_ADDRESS_RE = /^[^*]+\*[^*]+$/

/**
 * Resolves a federation address (e.g., "alice*stellar.org") to an account ID.
 *
 * Results are cached in the shared QueryStore and deduplicated.
 *
 * @example
 * const { record } = useFederationLookup({ address: "alice*stellar.org" })
 */
export function useFederationLookup({
  address,
  staleTime,
}: UseFederationLookupOptions & { staleTime?: number } = {}): UseFederationLookupReturn {
  const { queryStore } = useStellarContext()

  const normalizedAddress = typeof address === "string" ? address.trim() : null
  const formatValid = normalizedAddress ? FEDERATION_ADDRESS_RE.test(normalizedAddress) : false

  const queryKey =
    normalizedAddress && formatValid
      ? federationKey(normalizedAddress)
      : (["federation", "disabled"] as const)

  const {
    data: record,
    loading,
    error: rawError,
    refetch,
  } = useQuery<FederationRecord>({
    queryKey,
    queryFn: async () => {
      const raw = await Federation.Server.resolve(normalizedAddress!)
      return {
        stellarAddress: normalizedAddress!,
        accountId: raw.account_id,
        memoType: raw.memo_type ?? undefined,
        memo: raw.memo ?? undefined,
      }
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(normalizedAddress) && formatValid,
  })

  // Invalid format → immediate validation error, no network request.
  if (normalizedAddress && !formatValid) {
    const validationError: StellarError = createStellarError(
      "VALIDATION_ERROR",
      "Federated address must be in the form name*domain."
    )
    return {
      record: null,
      loading: false,
      error: validationError,
      refetch,
    }
  }

  const error = rawError ? toStellarError(rawError) : null

  return { record, loading, error, refetch }
}
