import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import { createAccount as createAccountAction, offlineError, onlineManager, toStellarError, type CreateAccountOptions, type TransactionResult, type StellarError } from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseCreateAccountReturn {
  createAccount: (options: CreateAccountOptions) => Promise<TransactionResult>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}

export function useCreateAccount(): UseCreateAccountReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<TransactionResult | null>(null)
  let operationId = 0
  let disposed = false
  const isCurrent = (id: number) => !disposed && id === operationId

  async function createAccount(options: CreateAccountOptions): Promise<TransactionResult> {
    if (!onlineManager.isOnline()) throw offlineError()
    const id = ++operationId
    loading.value = true
    error.value = null
    result.value = null
    try {
      const outcome = await createAccountAction({ network: runtime.network, networkConfig: runtime.networkConfig, wallet: runtime.wallet, queryStore: runtime.queryStore }, options)
      if (isCurrent(id)) result.value = outcome
      return outcome
    } catch (caught) {
      const failure = toStellarError(caught)
      if (isCurrent(id)) {
        error.value = failure
        if (failure?.code === "TX_TIMEOUT") result.value = { hash: failure.hash ?? "", status: "pending" }
      }
      throw failure
    } finally { if (isCurrent(id)) loading.value = false }
  }
  function reset(): void { operationId += 1; loading.value = false; error.value = null; result.value = null }
  onScopeDispose(() => { disposed = true; operationId += 1 })
  return { createAccount, loading, error, result, reset }
}
