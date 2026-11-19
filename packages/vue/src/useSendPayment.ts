import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import {
  isPreflightError,
  offlineError,
  onlineManager,
  sendPayment,
  SendPaymentAbortedError,
  type SendPaymentOptions,
  type SendPaymentResult,
  type StellarError,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseSendPaymentReturn {
  send: (options: SendPaymentOptions) => Promise<SendPaymentResult & { error?: string }>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<SendPaymentResult | null>
  reset: () => void
}

/**
 * Sends a Stellar payment through the framework-neutral core action while
 * keeping Vue state scoped to the calling component.
 */
export function useSendPayment(): UseSendPaymentReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<SendPaymentResult | null>(null)
  let operationId = 0
  let disposed = false

  const isCurrent = (id: number): boolean => !disposed && id === operationId

  async function send(
    options: SendPaymentOptions
  ): Promise<SendPaymentResult & { error?: string }> {
    if (!onlineManager.isOnline()) throw offlineError()

    const id = ++operationId
    const previousError = error.value
    const previousResult = result.value
    loading.value = true
    error.value = null
    result.value = null

    try {
      const outcome = await sendPayment(
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
      if (caught instanceof SendPaymentAbortedError) {
        return { hash: "", status: "failed", error: caught.message }
      }

      if (isPreflightError(caught)) {
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

  return { send, loading, error, result, reset }
}
