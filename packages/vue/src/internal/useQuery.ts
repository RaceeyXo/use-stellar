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
  focusManager,
  onlineManager,
  serializeKey,
  type QueryObserver,
  type QueryStore,
} from "use-stellar/core"

interface LifecycleConfig { refetchOnFocus: boolean; refetchOnReconnect: boolean }
interface LifecycleState { observers: Set<QueryObserver<unknown>>; cleanup: Array<() => void>; config: LifecycleConfig }
const lifecycles = new WeakMap<QueryStore, LifecycleState>()

export function configureQueryLifecycle(store: QueryStore, config: Partial<LifecycleConfig>): void {
  const current = lifecycles.get(store)
  const resolved = { refetchOnFocus: config.refetchOnFocus ?? true, refetchOnReconnect: config.refetchOnReconnect ?? true }
  if (current) current.config = resolved
  else lifecycles.set(store, { observers: new Set(), cleanup: [], config: resolved })
}

function registerActiveObserver(store: QueryStore, observer: QueryObserver<unknown>): () => void {
  let state = lifecycles.get(store)
  if (!state) {
    state = { observers: new Set(), cleanup: [], config: { refetchOnFocus: true, refetchOnReconnect: true } }
    lifecycles.set(store, state)
  }
  state.observers.add(observer)
  if (state.cleanup.length === 0 && typeof window !== "undefined") {
    state.cleanup.push(
      focusManager.subscribe(focused => { if (focused && state!.config.refetchOnFocus) state!.observers.forEach(item => void item.fetch()) }),
      onlineManager.subscribe(online => { if (online && state!.config.refetchOnReconnect) state!.observers.forEach(item => void item.fetch()) })
    )
  }
  return () => {
    state!.observers.delete(observer)
    if (state!.observers.size === 0) { state!.cleanup.forEach(cleanup => cleanup()); state!.cleanup = [] }
  }
}

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
  let unregisterLifecycle: (() => void) | null = null

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
    unregisterLifecycle = registerActiveObserver(options.store, observer as QueryObserver<unknown>)
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
    }
    // Batched (the default "pre" flush), not "sync": inputs that change in
    // the same tick — a contract id and a method, say — must produce one
    // query for the final combination, not an extra request for every
    // half-updated one in between.
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
    unregisterLifecycle?.()
    observer?.destroy()
    unsubscribe = null
    unregisterLifecycle = null
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
