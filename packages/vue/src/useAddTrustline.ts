import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import {
  addTrustline as runAddTrustline,
  AddTrustlineAbortedError,
  isAddTrustlinePreflightError,
  offlineError,
  onlineManager,
  type AddTrustlineOptions,
  type StellarError,
  type TransactionResult,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseAddTrustlineReturn {
  addTrustline: (options: AddTrustlineOptions) => Promise<TransactionResult>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}

/** Adds an issued-asset trustline through the shared core transaction action. */
export function useAddTrustline(): UseAddTrustlineReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<TransactionResult | null>(null)
  let operationId = 0
  let disposed = false

  const isCurrent = (id: number): boolean => !disposed && id === operationId

  async function addTrustline(options: AddTrustlineOptions): Promise<TransactionResult> {
    if (!onlineManager.isOnline()) throw offlineError()

    const id = ++operationId
    const previousError = error.value
    const previousResult = result.value
    loading.value = true
    error.value = null
    result.value = null

    try {
      const outcome = await runAddTrustline(
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
      if (caught instanceof AddTrustlineAbortedError) {
        return { hash: "", status: "failed" }
      }

      if (isAddTrustlinePreflightError(caught)) {
        if (isCurrent(id)) {
          error.value = previousError
          result.value = previousResult
        }
        throw caught
      }

      const stellarError = caught as StellarError
      if (isCurrent(id)) {
        if (stellarError.code === "TX_TIMEOUT") {
          result.value = { hash: stellarError.hash ?? "", status: "pending" }
        } else if (
          (stellarError as StellarError & { isSubmissionFailure?: boolean }).isSubmissionFailure
        ) {
          result.value = { hash: stellarError.hash ?? "", status: "failed" }
        }
        error.value = stellarError
      }
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

  return { addTrustline, loading, error, result, reset }
}
