import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import {
  invokeContract,
  toStellarError,
  type SorobanInvokeOptions,
  type StellarError,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

/**
 * The outcome of the latest `invoke`.
 *
 * - `success`: the call is in a ledger; `result` is the decoded return value.
 * - `pending`: polling timed out (`TX_TIMEOUT`). The transaction may still
 *   succeed — poll `hash` to find out.
 * - `failed`: the transaction was submitted and rejected, or failed on-chain.
 */
export interface SorobanWriteState<T = unknown> {
  hash: string
  status: "success" | "pending" | "failed"
  result: T | null
}

export interface UseSorobanWriteReturn<T = unknown> {
  /** Resolves with `{ hash, result }` like the React hook, and throws the `StellarError` on failure. */
  invoke: (options: SorobanInvokeOptions) => Promise<{ hash: string; result: T }>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<SorobanWriteState<T> | null>
  reset: () => void
}

/**
 * Invokes a state-changing Soroban contract method — the Vue counterpart of the
 * React `useSorobanWrite` hook, through the same core `invokeContract` action.
 *
 * State after each outcome:
 * | outcome                      | `result`                          | `error`               |
 * | ---------------------------- | --------------------------------- | --------------------- |
 * | success                      | `{ hash, status: "success", result }` | `null`            |
 * | rejected signature, guard or simulation failure | `null`         | the `StellarError`    |
 * | `TX_TIMEOUT`                 | `{ hash, status: "pending", result: null }` | `TX_TIMEOUT` |
 * | submission / on-chain failure | `{ hash, status: "failed", result: null }` | `TRANSACTION_FAILED` |
 *
 * Each call gets an operation id: only the latest call writes the refs, so a
 * slow earlier call cannot overwrite a newer one, and nothing is written after
 * the owning scope is disposed. A deliberate abort rethrows without touching
 * `error`. On success the signer's account queries in the shared store are
 * invalidated.
 */
export function useSorobanWrite<T = unknown>(): UseSorobanWriteReturn<T> {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<SorobanWriteState<T> | null>(null)
  let operationId = 0
  let disposed = false

  const isCurrent = (id: number): boolean => !disposed && id === operationId

  async function invoke(options: SorobanInvokeOptions): Promise<{ hash: string; result: T }> {
    const id = ++operationId
    loading.value = true
    error.value = null
    result.value = null

    try {
      const outcome = await invokeContract<T>(runtime, options)
      if (isCurrent(id)) {
        result.value = { hash: outcome.hash, status: "success", result: outcome.result }
      }
      return outcome
    } catch (caught) {
      const stellarError = toStellarError(caught)
      // A deliberate cancellation is not a failure: unwind without reporting it.
      if (!stellarError) throw caught
      if (isCurrent(id)) {
        if (stellarError.code === "TX_TIMEOUT") {
          result.value = { hash: stellarError.hash ?? "", status: "pending", result: null }
        } else if (stellarError.code === "TRANSACTION_FAILED" && stellarError.hash) {
          result.value = { hash: stellarError.hash, status: "failed", result: null }
        }
        error.value = stellarError
      }
      throw stellarError
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

  return { invoke, loading, error, result, reset }
}
