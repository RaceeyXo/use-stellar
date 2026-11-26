import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import {
  assetKey,
  fetchAsset,
  toStellarError,
  type AssetInfo,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export type { AssetInfo }

export interface UseAssetOptions {
  code: MaybeRefOrGetter<string | null | undefined>
  issuer: MaybeRefOrGetter<string | null | undefined>
  autoFetch?: MaybeRefOrGetter<boolean | undefined>
  staleTime?: MaybeRefOrGetter<number | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UseAssetReturn {
  asset: ComputedRef<AssetInfo | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}

/** Asset metadata from Horizon. Shares `assetKey` with the React hook. */
export function useAsset(options: UseAssetOptions): UseAssetReturn {
  const runtime = useStellarRuntime()
  const code = computed(() => toValue(options.code)?.trim() || null)
  const issuer = computed(() => toValue(options.issuer)?.trim() || null)
  const autoFetch = computed(() => toValue(options.autoFetch) !== false)

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      assetKey(
        runtime.networkConfig.horizonUrl,
        runtime.networkConfig.network,
        code.value ?? "",
        issuer.value ?? ""
      ),
    queryFn: () => fetchAsset(runtime.networkConfig, { code: code.value!, issuer: issuer.value! }),
    enabled: () => code.value !== null && issuer.value !== null && autoFetch.value,
    staleTime: options.staleTime,
    maxRetries: options.maxRetries,
  })

  return {
    asset: computed(() => query.data.value),
    loading: computed(() =>
      code.value && issuer.value && autoFetch.value ? query.loading.value : false
    ),
    error: computed(() => {
      if (!code.value || !issuer.value || !autoFetch.value) return null
      return query.error.value ? toStellarError(query.error.value) : null
    }),
    refetch: query.refetch,
  }
}
