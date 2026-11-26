import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from "vue"
import {
  depositLiquidity,
  fetchLiquidityPool,
  isLiquidityPoolSubmissionFailure,
  liquidityPoolKey,
  toStellarError,
  withdrawLiquidity,
  type LiquidityPool,
  type LiquidityPoolDepositOptions,
  type LiquidityPoolWithdrawOptions,
  type StellarError,
  type TransactionResult,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"

export interface UseLiquidityPoolOptions {
  /** The pool id (64 hex characters). Reactive; an empty value disables the query. */
  poolId: MaybeRefOrGetter<string | null | undefined>
  staleTime?: MaybeRefOrGetter<number | undefined>
  /** Retries after a rate limit (429), honouring `Retry-After`. Defaults to 3; 0 disables retrying. */
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

export interface UseLiquidityPoolReturn {
  pool: ComputedRef<LiquidityPool | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}

/**
 * Fetches a single AMM liquidity pool by id — the Vue counterpart of the React
 * `useLiquidityPool` hook, through the same core query, so the request, the
 * mapped data and the error codes are identical.
 *
 * Requests go through the runtime's shared query store: two composables asking
 * for the same pool share one request, and nothing is fetched during SSR.
 *
 * @example
 * const { pool, loading, error } = useLiquidityPool({ poolId })
 */
export function useLiquidityPool(options: UseLiquidityPoolOptions): UseLiquidityPoolReturn {
  const runtime = useStellarRuntime()
  const poolId = computed(() => toValue(options.poolId)?.trim() || null)

  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      liquidityPoolKey(
        runtime.networkConfig.horizonUrl,
        runtime.networkConfig.network,
        poolId.value ?? ""
      ),
    queryFn: () => fetchLiquidityPool(runtime.networkConfig, { poolId: poolId.value! }),
    enabled: () => poolId.value !== null,
    staleTime: options.staleTime,
    maxRetries: options.maxRetries,
  })

  return {
    pool: computed(() => query.data.value),
    loading: computed(() => query.loading.value),
    error: computed(() => query.error.value as StellarError | null),
    refetch: query.refetch,
  }
}

export interface UseLiquidityPoolActionsReturn {
  deposit: (options: LiquidityPoolDepositOptions) => Promise<TransactionResult | null>
  withdraw: (options: LiquidityPoolWithdrawOptions) => Promise<TransactionResult | null>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}

/**
 * Deposits into and withdraws from an AMM liquidity pool — the Vue counterpart
 * of the React `useLiquidityPoolActions` hook, through the same core actions.
 *
 * Like the React hook, `deposit`/`withdraw` never throw: a failure resolves to
 * `null` and is reported through `error`. A submission Horizon rejected also
 * records `result` as `{ hash, status: "failed" }`. Only the latest call writes
 * the refs, so a slow earlier call cannot overwrite a newer one. On success the
 * account and pool queries in the shared store are invalidated.
 */
export function useLiquidityPoolActions(): UseLiquidityPoolActionsReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<TransactionResult | null>(null)
  let operationId = 0
  let disposed = false

  const isCurrent = (id: number): boolean => !disposed && id === operationId

  async function run(action: () => Promise<TransactionResult>): Promise<TransactionResult | null> {
    const id = ++operationId
    loading.value = true
    error.value = null

    try {
      const outcome = await action()
      if (isCurrent(id)) result.value = outcome
      return outcome
    } catch (caught) {
      if (isCurrent(id)) {
        if (isLiquidityPoolSubmissionFailure(caught)) {
          result.value = { hash: (caught as StellarError).hash ?? "", status: "failed" }
        }
        error.value = toStellarError(caught)
      }
      return null
    } finally {
      if (isCurrent(id)) loading.value = false
    }
  }

  const deposit = (options: LiquidityPoolDepositOptions) =>
    run(() => depositLiquidity(runtime, options))

  const withdraw = (options: LiquidityPoolWithdrawOptions) =>
    run(() => withdrawLiquidity(runtime, options))

  function reset(): void {
    operationId += 1
    loading.value = false
    error.value = null
    result.value = null
  }

  onScopeDispose(() => {
    disposed = true
    operationId += 1
  })

  return { deposit, withdraw, loading, error, result, reset }
}
