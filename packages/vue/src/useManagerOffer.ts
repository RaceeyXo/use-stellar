import { onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from "vue"
import {
  createOffer as createOfferAction,
  updateOffer as updateOfferAction,
  cancelOffer as cancelOfferAction,
  offlineError,
  onlineManager,
  toStellarError,
  type ManageOfferParams,
  type TransactionResult,
  type StellarError,
} from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseManageOfferReturn {
  createOffer: (params: ManageOfferParams) => Promise<TransactionResult | null>
  updateOffer: (offerId: string, params: ManageOfferParams) => Promise<TransactionResult | null>
  cancelOffer: (offerId: string) => Promise<TransactionResult | null>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}
export function useManageOffer(): UseManageOfferReturn {
  const runtime = useStellarRuntime()
  const loading = ref(false)
  const error = shallowRef<StellarError | null>(null)
  const result = shallowRef<TransactionResult | null>(null)
  let operationId = 0
  let disposed = false
  const isCurrent = (id: number) => !disposed && id === operationId
  async function perform(
    action: () => Promise<TransactionResult>
  ): Promise<TransactionResult | null> {
    const id = ++operationId
    if (!onlineManager.isOnline()) {
      if (isCurrent(id)) {
        error.value = offlineError()
        loading.value = false
      }
      return null
    }
    loading.value = true
    error.value = null
    try {
      const outcome = await action()
      if (isCurrent(id)) result.value = outcome
      return outcome
    } catch (caught) {
      const failure = toStellarError(caught)
      if (isCurrent(id)) {
        error.value = failure
        if (failure?.code === "TX_TIMEOUT")
          result.value = { hash: failure.hash ?? "", status: "pending" }
      }
      return null
    } finally {
      if (isCurrent(id)) loading.value = false
    }
  }
  const createOffer = (params: ManageOfferParams) =>
    perform(() => createOfferAction(runtime, params))
  const updateOffer = (offerId: string, params: ManageOfferParams) =>
    perform(() => updateOfferAction(runtime, offerId, params))
  const cancelOffer = (offerId: string) => perform(() => cancelOfferAction(runtime, offerId))
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
  return { createOffer, updateOffer, cancelOffer, loading, error, result, reset }
}
/** Compatibility spelling retained for the original issue/API name. */
export const useManagerOffer = useManageOffer
