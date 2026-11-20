import { computed, getCurrentInstance, onMounted, onScopeDispose, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue"
import { createPaymentStream, type NormalizedPayment, type PaymentStreamController, type StellarError } from "use-stellar/core"
import { useStellarRuntime } from "./plugin"

export interface UseStreamPaymentsOptions { address?: MaybeRefOrGetter<string | null | undefined>; cursor?: MaybeRefOrGetter<string | undefined>; bufferSize?: MaybeRefOrGetter<number | undefined>; enabled?: MaybeRefOrGetter<boolean | undefined> }
export interface UseStreamPaymentsReturn { payments: ComputedRef<NormalizedPayment[]>; connected: ComputedRef<boolean>; error: ComputedRef<StellarError | null>; cursor: ComputedRef<string | null>; reconnect: () => void; clear: () => void }

export function useStreamPayments(options: UseStreamPaymentsOptions = {}): UseStreamPaymentsReturn {
  const runtime = useStellarRuntime()
  const address = computed(() => (options.address === undefined ? runtime.walletAddress.value : toValue(options.address))?.trim() || null)
  const snapshot = shallowRef({ payments: [] as NormalizedPayment[], connected: false, error: null as StellarError | null, cursor: null as string | null })
  let controller: PaymentStreamController | null = null
  let unsubscribe: (() => void) | null = null
  const stop = () => { unsubscribe?.(); controller?.close(); unsubscribe = null; controller = null }
  const start = () => {
    stop()
    if (typeof window === "undefined" || !address.value || !(toValue(options.enabled) ?? true)) return
    controller = createPaymentStream({ networkConfig: runtime.networkConfig, address: address.value, cursor: toValue(options.cursor) ?? "now", bufferSize: toValue(options.bufferSize) ?? 50 })
    unsubscribe = controller.subscribe(value => snapshot.value = value)
    controller.start()
  }
  watch([address, () => toValue(options.cursor), () => toValue(options.bufferSize), () => toValue(options.enabled)], start)
  if (getCurrentInstance()) onMounted(start); else start()
  onScopeDispose(stop)
  return { payments: computed(() => snapshot.value.payments), connected: computed(() => snapshot.value.connected), error: computed(() => snapshot.value.error), cursor: computed(() => snapshot.value.cursor), reconnect: () => controller?.reconnect(), clear: () => controller?.clear() }
}
