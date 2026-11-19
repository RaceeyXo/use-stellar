import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import {
  filterPayments,
  type Asset,
  type NormalizedPayment,
  type StellarError,
} from "use-stellar/core"
import { usePayments, type UsePaymentsOptions } from "./usePayments"

export interface UsePaymentHistoryOptions extends UsePaymentsOptions {
  direction?: MaybeRefOrGetter<"incoming" | "outgoing" | "all" | undefined>
  asset?: MaybeRefOrGetter<Asset | "all" | undefined>
}

export interface UsePaymentHistoryReturn {
  payments: ComputedRef<NormalizedPayment[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  isStale: ComputedRef<boolean>
  refetch: () => Promise<void>
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: ComputedRef<boolean>
  hasPrev: ComputedRef<boolean>
}

/**
 * Filters the current `usePayments` page without issuing another request.
 * Filtering is intentionally page-local; pagination continues to follow the
 * unfiltered Horizon result set.
 */
export function usePaymentHistory(options: UsePaymentHistoryOptions = {}): UsePaymentHistoryReturn {
  const payments = usePayments({
    address: options.address,
    limit: options.limit,
    order: options.order,
    cursor: options.cursor,
    maxRetries: options.maxRetries,
  })

  return {
    ...payments,
    payments: computed(() =>
      filterPayments(payments.payments.value, {
        direction: toValue(options.direction) ?? "all",
        asset: toValue(options.asset) ?? "all",
      })
    ),
  }
}
