import { useEffect, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { createStellarError, toStellarError } from "../errors"
import { useQuery, assetKey } from "../cache"
import type { StellarError } from "../types"

export interface AssetInfo {
  code: string
  issuer: string
  supply: string
  homeDomain?: string
  numAccounts: number
  flags: {
    authRequired: boolean
    authRevocable: boolean
    authImmutable: boolean
  }
}

export interface UseAssetOptions {
  code: string
  issuer: string
  autoFetch?: boolean
  /** Override the provider-level staleTime for this hook instance (ms). */
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}

export interface UseAssetReturn {
  asset: AssetInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

/**
 * Fetches details about a specific asset on the Stellar network.
 *
 * Results are cached in the shared QueryStore and deduplicated.
 *
 * @param options - Configuration options
 * @param options.code - The asset code (e.g., "USDC")
 * @param options.issuer - The asset issuer's Stellar address
 * @param options.autoFetch - Whether to automatically fetch on mount (default: true)
 * @param options.staleTime - Override the provider-level staleTime for this hook.
 * @returns `{ asset, loading, error, refetch }`
 *
 * @example
 * const { asset, loading } = useAsset({ code: "USDC", issuer: "G..." })
 */
export function useAsset({
  code,
  issuer,
  autoFetch = true,
  staleTime,
  maxRetries,
}: UseAssetOptions): UseAssetReturn {
  const { network, networkConfig, queryStore } = useStellarContext()

  const queryKey = assetKey(networkConfig.horizonUrl, network, code, issuer)
  const queryIdentity = `${networkConfig.horizonUrl}|${network}|${code}|${issuer}`
  const previousQueryIdentity = useRef(queryIdentity)
  const queryChanged = previousQueryIdentity.current !== queryIdentity

  useEffect(() => {
    previousQueryIdentity.current = queryIdentity
  }, [queryIdentity])

  const {
    data: asset,
    loading,
    error: rawError,
    refetch,
  } = useQuery<AssetInfo>({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(networkConfig)
      const res = await server.assets().forCode(code).forIssuer(issuer).call()

      const raw = res.records[0]
      if (!raw) {
        throw createStellarError("ASSET_NOT_FOUND", `Asset ${code}:${issuer} not found.`)
      }
      const assetRecord = raw as typeof raw & { home_domain?: string }

      return {
        code: raw.asset_code,
        issuer: raw.asset_issuer,
        supply: raw.amount,
        numAccounts: raw.num_accounts,
        homeDomain: assetRecord.home_domain,
        flags: {
          authRequired: raw.flags.auth_required,
          authRevocable: raw.flags.auth_revocable,
          authImmutable: raw.flags.auth_immutable,
        },
      }
    },
    store: queryStore,
    staleTime,
    enabled: autoFetch,
    maxRetries,
  })

  const error = rawError ? toStellarError(rawError) : null

  return { asset: queryChanged ? null : asset, loading, error, refetch }
}
