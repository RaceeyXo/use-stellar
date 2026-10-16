import {
  computed,
  getCurrentInstance,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue"
import {
  createQueryObserver,
  serializeKey,
  type QueryObserver,
  type QueryStore,
} from "use-stellar/core"

export interface UseQueryOptions<T> {
  queryKey: () => readonly unknown[]
  queryFn: () => Promise<T>
  store: QueryStore
  enabled?: () => boolean
  staleTime?: MaybeRefOrGetter<number | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
  /** Explicitly opt into server-side fetching. Disabled by default. */
  ssr?: boolean
}

export interface UseQueryReturn<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<unknown>
  updatedAt: Ref<number | null>
  rateLimitedUntil: ComputedRef<number | null>
  refetch: () => Promise<void>
}

/** Projects the framework-neutral query observer into Vue refs. */
export function useQuery<T>(options: UseQueryOptions<T>): UseQueryReturn<T> {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = shallowRef<unknown>(null)
  const updatedAt = ref<number | null>(null)
  let observer: QueryObserver<T> | null = null
  let unsubscribe: (() => void) | null = null

  const resolved = computed(() => ({
    queryKey: options.queryKey(),
    queryFn: options.queryFn,
    store: options.store,
    enabled: options.enabled?.() ?? true,
    staleTime: toValue(options.staleTime),
    maxRetries: toValue(options.maxRetries),
  }))

  function project(snapshot: ReturnType<QueryObserver<T>["getSnapshot"]>): void {
    data.value = snapshot.data
    loading.value = snapshot.loading
    error.value = snapshot.error
    updatedAt.value = snapshot.updatedAt
  }

  function start(): void {
    if (observer) return
    observer = createQueryObserver<T>(resolved.value)
    unsubscribe = observer.subscribe(project)
    project(observer.getSnapshot())
  }

  watch(
    () => [
      serializeKey(resolved.value.queryKey),
      resolved.value.enabled,
      resolved.value.staleTime,
      resolved.value.maxRetries,
    ],
    () => {
      observer?.setOptions(resolved.value)
      if (observer) project(observer.getSnapshot())
    },
    { flush: "sync" }
  )

  // Component setup is deferred until mount so SSR performs no request and
  // client hydration starts from the same idle projection. Test/effect scopes
  // have no component lifecycle, so they start immediately.
  if (getCurrentInstance()) {
    if (typeof (globalThis as { window?: unknown }).window === "undefined" && options.ssr) start()
    else onMounted(start)
  } else {
    start()
  }

  onScopeDispose(() => {
    unsubscribe?.()
    observer?.destroy()
    unsubscribe = null
    observer = null
  })

  return {
    data,
    loading,
    error,
    updatedAt,
    rateLimitedUntil: computed(() => observer?.getRateLimitedUntil() ?? null),
    refetch: () => observer?.fetch({ force: true }) ?? Promise.resolve(),
  }
}
