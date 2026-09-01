import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, claimableBalanceKey } from "../cache"
import type { ClaimableBalance, StellarError } from "../types"

export interface UseClaimableBalanceOptions {
  address?: string | null // defaults to connected wallet address
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
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
 * Follows a stale-while-revalidate contract: a failed fetch never clears
 * `balances` — it only sets `error` and flips `isStale` to `true`, so the
 * consumer can keep rendering the last known-good balances instead of
 * nothing. `balances` is only cleared when the query itself changes
 * (`address`), or when Horizon reports no claimable balances (a 404), since
 * that is a legitimately empty result rather than a transient failure.
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
}: UseClaimableBalanceOptions = {}): UseClaimableBalanceReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()
  const resolvedAddress = address ?? wallet.address

  const queryKey = resolvedAddress
    ? claimableBalanceKey(networkConfig.horizonUrl, network, resolvedAddress)
    : (["claimableBalance", "disabled"] as const)

  // Monotonic id used to ignore superseded responses (e.g. when the
  // address/network changes mid-flight). This is distinct from unmount
  // cancellation below — a superseded fetch is discarded because a newer
  // fetch owns the state, while a cancelled fetch is discarded because
  // there is no component left to update.
  const requestRef = useRef(0)
  // Set only by the effect cleanup on unmount. Reset at the top of the
  // effect so it doesn't leak across re-runs.
  const cancelledRef = useRef(false)

  const fetchBalances = useCallback(async () => {
    if (!resolvedAddress) {
      setBalances([])
      setLoading(false)
      return
    }

    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      const server = getHorizonServer(network)
      const result = await server.claimableBalances().claimant(resolvedAddress).call()

      if (cancelledRef.current || fetchId !== requestRef.current) return

      const parsed: ClaimableBalance[] = result.records.map(record => ({
        id: record.id,
        asset: record.asset,
        amount: record.amount,
        claimants: record.claimants.map(c => ({
          destination: c.destination,
          predicate: c.predicate as object,
        })),
        sponsor: record.sponsor,
      }))

      setBalances(parsed)
    } catch (err) {
      if (cancelledRef.current || fetchId !== requestRef.current) return
      const stellarError = toStellarError(err)
      // A 404 means the account has no claimable balances — that's a
      // legitimately empty result, not a transient failure, so it clears
      // balances rather than preserving stale data.
      if (stellarError.code === "ACCOUNT_NOT_FOUND") {
        setBalances([])
      } else {
        // Stale-while-revalidate: a transient failure keeps the last
        // known-good balances in place and only surfaces the error.
      // A 404 means the account has no claimable balances — treat as empty
      if (stellarError.code === "ACCOUNT_NOT_FOUND") {
        setBalances([])
      } else {
        setBalances([])
        setError(stellarError)
      }
    } finally {
      if (!cancelledRef.current && fetchId === requestRef.current) {
        setLoading(false)
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
  })

  // Clear stale data synchronously the moment the query changes (address),
  // before the new fetch resolves — otherwise there's a window where the
  // previous account's balances render under the new query. Refetches must
  // NOT hit this: they keep the old data in place until the new fetch
  // settles, per stale-while-revalidate.
  useEffect(() => {
    setBalances([])
    setError(null)
  }, [resolvedAddress, network])

  useEffect(() => {
    cancelledRef.current = false
    fetchBalances()
    return () => {
      cancelledRef.current = true
    }
  }, [fetchBalances])

  const isStale = error !== null && balances.length > 0

  return { balances, loading, error, isStale, refetch: fetchBalances }
  const error = rawError ? toStellarError(rawError) : null

  return { balances: data ?? [], loading, error, refetch }
}
