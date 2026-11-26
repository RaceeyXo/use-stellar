# usePaymentHistory

Filters the payments on screen by direction and asset. It wraps [`usePayments`](./use-payments.md) and issues no extra requests.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { usePaymentHistory } from "@use-stellar/vue"
```

## Basic usage

```vue
<script setup lang="ts">
import { usePaymentHistory } from "@use-stellar/vue"

const { payments, loading, error } = usePaymentHistory({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
  direction: "incoming",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Could not load payments.</p>
  <ul v-else>
    <li v-for="payment in payments" :key="payment.id">+{{ payment.amount }}</li>
  </ul>
</template>
```

## Parameters

It accepts every [`usePayments`](./use-payments.md#parameters) option (`address`, `limit`, `order`, `cursor`, `maxRetries`) plus two filters:

| Parameter   | Type                                                               | Required | Default | Description                                                           |
| ----------- | ------------------------------------------------------------------ | -------- | ------- | --------------------------------------------------------------------- |
| `direction` | `MaybeRefOrGetter<"incoming" \| "outgoing" \| "all" \| undefined>` | No       | `"all"` | Keep only payments the account received, only those it sent, or both. |
| `asset`     | `MaybeRefOrGetter<Asset \| "all" \| undefined>`                    | No       | `"all"` | Keep only one asset: `"XLM"` or an issued `{ code, issuer }`.         |

## Return values

The same as [`usePayments`](./use-payments.md#return-values). Only `payments` differs: it holds the filtered records.

| Property    | Type                                | Description                                       |
| ----------- | ----------------------------------- | ------------------------------------------------- |
| `payments`  | `ComputedRef<NormalizedPayment[]>`  | The current page after filtering.                 |
| `loading`   | `ComputedRef<boolean>`              | `true` during the first request and navigation.   |
| `error`     | `ComputedRef<StellarError \| null>` | The latest failure, or `null`.                    |
| `isStale`   | `ComputedRef<boolean>`              | `true` when `error` is set with a page on screen. |
| `refetch`   | `() => Promise<void>`               | Re-runs the first-page query.                     |
| `fetchNext` | `() => Promise<void>`               | Loads the next unfiltered page.                   |
| `fetchPrev` | `() => Promise<void>`               | Loads the previous unfiltered page.               |
| `hasNext`   | `ComputedRef<boolean>`              | `true` when another page exists.                  |
| `hasPrev`   | `ComputedRef<boolean>`              | `true` when a previous page exists.               |

## Examples

### Example 1 - the common case

```vue
<script setup lang="ts">
import { usePaymentHistory } from "@use-stellar/vue"

const { payments } = usePaymentHistory({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
  direction: "outgoing",
})
</script>

<template>
  <output>{{ payments.length }} sent</output>
</template>
```

### Example 2 - reactive filters and an issued asset

Changing a filter re-filters the page already loaded. It does not refetch.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { usePaymentHistory } from "@use-stellar/vue"

const direction = ref<"incoming" | "outgoing" | "all">("all")
const { payments } = usePaymentHistory({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
  direction,
  asset: {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
})
</script>

<template>
  <select v-model="direction">
    <option value="all">All</option>
    <option value="incoming">Received</option>
    <option value="outgoing">Sent</option>
  </select>
  <ul>
    <li v-for="payment in payments" :key="payment.id">{{ payment.amount }} USDC</li>
  </ul>
</template>
```

### Example 3 - handling errors and retrying

```vue
<script setup lang="ts">
import { usePaymentHistory } from "@use-stellar/vue"

const { payments, error, refetch } = usePaymentHistory({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <div v-if="error">
    <p>{{ error.message }}</p>
    <button type="button" @click="refetch">Try again</button>
  </div>
  <ul v-else>
    <li v-for="payment in payments" :key="payment.id">{{ payment.amount }}</li>
  </ul>
</template>
```

## TypeScript

```ts
interface UsePaymentHistoryOptions extends UsePaymentsOptions {
  direction?: MaybeRefOrGetter<"incoming" | "outgoing" | "all" | undefined>
  asset?: MaybeRefOrGetter<Asset | "all" | undefined>
}

interface UsePaymentHistoryReturn {
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
```

## Common errors

The errors are those of [`usePayments`](./use-payments.md#common-errors): `ACCOUNT_NOT_FOUND`, `NETWORK_ERROR` and `RATE_LIMITED`.

## Notes

- Filtering is page-local. Pagination follows the unfiltered Horizon result set, so a narrow filter can leave a page short or empty while `hasNext` is still `true`.
- Unlike the React hook, this composable does not keep fetching pages to fill `limit`, and has no `maxAccumulationPages` option or `accumulationBoundHit` value.

## Differences from React

React's `usePaymentHistory` accumulates pages until it has `limit` matches. The Vue composable only filters the current page.

## Related hooks

- [React `usePaymentHistory`](../hooks/use-payment-history.md) - the equivalent React API.
- [`usePayments`](./use-payments.md) - the unfiltered pages this composable reads.
