import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import {
  isPathPaymentPreflightError,
  offlineError,
  onlineManager,
  pathPayment as runPathPayment,
  type PathPaymentOptions,
  type StellarError,
  type TransactionResult,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UsePathPaymentReturn {
  pathPayment: (options: PathPaymentOptions) => Promise<TransactionResult>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}

/** Submits a slippage-bounded path payment through the shared core action. */
export function usePathPayment(): UsePathPaymentReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<TransactionResult | null>(null)
  let operationId = 0
  let disposed = false

  const isCurrent = (id: number): boolean => !disposed && id === operationId

  async function pathPayment(options: PathPaymentOptions): Promise<TransactionResult> {
    if (!onlineManager.isOnline()) throw offlineError()

    const id = ++operationId
    const previousError = error.value
    const previousResult = result.value
    loading.value = true
    error.value = null
    result.value = null

    try {
      const outcome = await runPathPayment(
        {
          network: runtime.network,
          networkConfig: runtime.networkConfig,
          wallet: runtime.wallet,
          queryStore: runtime.queryStore,
        },
        options
      )
      if (isCurrent(id)) result.value = outcome
      return outcome
    } catch (caught) {
      if (isPathPaymentPreflightError(caught)) {
        if (isCurrent(id)) {
          error.value = previousError
          result.value = previousResult
        }
        throw caught
      }

      if (isCurrent(id)) error.value = caught as StellarError
      throw caught
    } finally {
      if (isCurrent(id)) loading.value = false
    }
  }

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

  return { pathPayment, loading, error, result, reset }
}
