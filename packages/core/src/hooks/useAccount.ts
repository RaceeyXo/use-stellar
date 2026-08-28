import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, parseHorizonBalance } from "../utils"
import { toStellarError } from "../errors"
import { useQuery, accountKey } from "../cache"
import type { AccountInfo, StellarError } from "../types"

export interface UseAccountOptions {
  address?: string | null // defaults to connected wallet address
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
}

export interface UseAccountReturn {
  account: AccountInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

/**
 * Fetches account information including balances, sequence number, and signers.
 *
 * Results are cached in the shared QueryStore and deduplicated: two components
 * calling useAccount for the same address issue exactly one network request.
 *
 * @param options - Configuration options
 * @param options.address - The Stellar address to fetch. Defaults to the connected wallet.
 * @param options.staleTime - Override the provider-level staleTime for this hook.
 * @returns `{ account, loading, error, refetch }`
 *
 * @example
 * const { account, loading } = useAccount({ address: "G..." })
 */
export function useAccount({ address, staleTime }: UseAccountOptions = {}): UseAccountReturn {
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
  })

  const error = rawError ? toStellarError(rawError) : null

  return { account, loading, error, refetch }
}
