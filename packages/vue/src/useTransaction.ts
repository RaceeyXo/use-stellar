import {
  computed,
  onScopeDispose,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue"
import {
  fetchTransaction,
  toStellarError,
  transactionKey,
  type StellarError,
  type TransactionResult,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

const POLL_MS = 3000

export interface UseTransactionOptions {
  hash: MaybeRefOrGetter<string | null | undefined>
  /** Poll every 3s until the status is `success` or `failed`. */
  watch?: MaybeRefOrGetter<boolean | undefined>
  staleTime?: MaybeRefOrGetter<number | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UseTransactionReturn {
  transaction: ComputedRef<TransactionResult | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}

function pageFocused(): boolean {
  if (typeof document === "undefined") return true
  return document.visibilityState !== "hidden"
}

/** Transaction status by hash. Shares `transactionKey` with the React hook. */
export function useTransaction(options: UseTransactionOptions): UseTransactionReturn {
  const runtime = useStellarRuntime()
  const hash = computed(() => toValue(options.hash)?.trim() || null)
  const watchMode = computed(() => toValue(options.watch) === true)

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      hash.value
        ? transactionKey(runtime.networkConfig.horizonUrl, runtime.networkConfig.network, hash.value)
        : (["transaction", "disabled"] as const),
    queryFn: () => fetchTransaction(runtime.networkConfig, { hash: hash.value!, watch: watchMode.value }),
    enabled: () => hash.value !== null,
    staleTime: options.staleTime,
    maxRetries: options.maxRetries,
  })

  let timer: ReturnType<typeof setInterval> | undefined
  const stop = () => {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  }

  watch(
    () => [hash.value, watchMode.value, query.data.value?.status] as const,
    () => {
      stop()
      if (!watchMode.value || !hash.value) return
      const status = query.data.value?.status
      if (status === "success" || status === "failed") return
      timer = setInterval(() => {
        if (!pageFocused()) return
        const current = query.data.value?.status
        if (current === "success" || current === "failed") {
          stop()
          return
        }
        void query.refetch()
      }, POLL_MS)
    },
    { immediate: true }
  )
  onScopeDispose(stop)

  return {
    transaction: computed(() => query.data.value),
    loading: computed(() => (hash.value ? query.loading.value : false)),
    error: computed(() => {
      if (!hash.value) return null
      return query.error.value ? toStellarError(query.error.value) : null
    }),
    refetch: query.refetch,
  }
}
