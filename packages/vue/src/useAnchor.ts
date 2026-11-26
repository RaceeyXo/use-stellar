import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import { fetchAnchorInfo, type AnchorInfo, type StellarError } from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UseAnchorOptions { homeDomain: MaybeRefOrGetter<string | null | undefined>; enabled?: MaybeRefOrGetter<boolean | undefined> }
export interface UseAnchorReturn { anchor: ComputedRef<AnchorInfo | null>; loading: ComputedRef<boolean>; error: ComputedRef<StellarError | null>; refetch: () => Promise<void> }

export function useAnchor(options: UseAnchorOptions): UseAnchorReturn {
  const runtime = useStellarRuntime()
  const domain = computed(() => toValue(options.homeDomain)?.trim().toLowerCase() || null)
  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () => ["anchor", runtime.network, domain.value],
    queryFn: () => fetchAnchorInfo(domain.value!, runtime.network),
    enabled: () => Boolean(domain.value) && (toValue(options.enabled) ?? true),
  })
  return { anchor: computed(() => query.data.value), loading: computed(() => query.loading.value), error: computed(() => query.error.value as StellarError | null), refetch: query.refetch }
}
