# usePayments

Fetches a paginated list of an account's payment operations, normalized into one shape whatever the underlying operation type.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { usePayments } from "@use-stellar/vue"
```

## Basic usage

```vue
<script setup lang="ts">
import { usePayments } from "@use-stellar/vue"

const { payments, loading, error, hasNext, fetchNext } = usePayments({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Could not load payments.</p>
  <template v-else>
    <ul>
      <li v-for="payment in payments" :key="payment.id">
        {{ payment.direction }} {{ payment.amount }}
        {{ payment.asset === "XLM" ? "XLM" : payment.asset.code }}
      </li>
    </ul>
    <button v-if="hasNext" type="button" @click="fetchNext">Load more</button>
  </template>
</template>
```

## Parameters

| Parameter    | Type                                             | Required | Default                  | Description                                                 |
| ------------ | ------------------------------------------------ | -------- | ------------------------ | ----------------------------------------------------------- |
| `address`    | `MaybeRefOrGetter<string \| null \| undefined>`  | No       | Connected wallet address | The account to read. Empty values keep the composable idle. |
| `limit`      | `MaybeRefOrGetter<number \| undefined>`          | No       | `10`                     | Records per page.                                           |
| `order`      | `MaybeRefOrGetter<"asc" \| "desc" \| undefined>` | No       | `"desc"`                 | Sort order. `"desc"` returns the newest payments first.     |
| `cursor`     | `MaybeRefOrGetter<string \| undefined>`          | No       | `undefined`              | A Horizon paging token to start the first page from.        |
| `maxRetries` | `MaybeRefOrGetter<number \| undefined>`          | No       | `3`                      | Retries after a rate limit (429). `0` disables retrying.    |

Changing `address`, `limit` or `order` drops any page navigation and starts again from the first page.

## Return values

| Property    | Type                                | Description                                               |
| ----------- | ----------------------------------- | --------------------------------------------------------- |
| `payments`  | `ComputedRef<NormalizedPayment[]>`  | The page on screen. Empty before the first page arrives.  |
| `loading`   | `ComputedRef<boolean>`              | `true` during the first request and page navigation.      |
| `error`     | `ComputedRef<StellarError \| null>` | The latest failure, or `null`.                            |
| `isStale`   | `ComputedRef<boolean>`              | `true` when `error` is set while a page is still shown.   |
| `refetch`   | `() => Promise<void>`               | Re-runs the first-page query and drops page navigation.   |
| `fetchNext` | `() => Promise<void>`               | Loads the next page. Does nothing when there is none.     |
| `fetchPrev` | `() => Promise<void>`               | Loads the previous page. Does nothing when there is none. |
| `hasNext`   | `ComputedRef<boolean>`              | `true` when another page exists.                          |
| `hasPrev`   | `ComputedRef<boolean>`              | `true` when a previous page exists.                       |

### `NormalizedPayment`

| Field       | Type                       | Description                                                            |
| ----------- | -------------------------- | ---------------------------------------------------------------------- |
| `id`        | `string`                   | The operation ID.                                                      |
| `txHash`    | `string`                   | The hash of the transaction the operation belongs to.                  |
| `type`      | `string`                   | The Horizon operation type, such as `"payment"` or `"create_account"`. |
| `from`      | `string`                   | The sending account.                                                   |
| `to`        | `string`                   | The receiving account.                                                 |
| `amount`    | `string`                   | The amount moved.                                                      |
| `asset`     | `Asset`                    | `"XLM"`, or `{ code, issuer }` for an issued asset.                    |
| `direction` | `"incoming" \| "outgoing"` | Whether the queried account received or sent it.                       |
| `createdAt` | `string`                   | ISO 8601 timestamp from Horizon.                                       |

## Examples

### Example 1 - the common case

```vue
<script setup lang="ts">
import { usePayments } from "@use-stellar/vue"

const { payments } = usePayments({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <ul>
    <li v-for="payment in payments" :key="payment.id">{{ payment.amount }}</li>
  </ul>
</template>
```

### Example 2 - paging with reactive input

```vue
<script setup lang="ts">
import { ref } from "vue"
import { usePayments } from "@use-stellar/vue"

const order = ref<"asc" | "desc">("desc")
const { payments, hasNext, hasPrev, fetchNext, fetchPrev } = usePayments({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
  limit: 5,
  order,
})
</script>

<template>
  <button type="button" @click="order = order === 'desc' ? 'asc' : 'desc'">Flip order</button>
  <ul>
    <li v-for="payment in payments" :key="payment.id">{{ payment.id }}</li>
  </ul>
  <button type="button" :disabled="!hasPrev" @click="fetchPrev">Previous</button>
  <button type="button" :disabled="!hasNext" @click="fetchNext">Next</button>
</template>
```

### Example 3 - handling errors and retrying

```vue
<script setup lang="ts">
import { usePayments } from "@use-stellar/vue"

const { payments, error, isStale, refetch } = usePayments({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <div v-if="error">
    <p>{{ error.message }}</p>
    <p v-if="isStale">Showing the last page that loaded.</p>
    <button type="button" @click="refetch">Try again</button>
  </div>
  <ul>
    <li v-for="payment in payments" :key="payment.id">{{ payment.amount }}</li>
  </ul>
</template>
```

## TypeScript

```ts
interface UsePaymentsOptions {
  address?: MaybeRefOrGetter<string | null | undefined>
  limit?: MaybeRefOrGetter<number | undefined>
  order?: MaybeRefOrGetter<"asc" | "desc" | undefined>
  cursor?: MaybeRefOrGetter<string | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

interface UsePaymentsReturn {
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

| Error code          | Cause                                       | Fix                                                                       |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `ACCOUNT_NOT_FOUND` | The address is not funded on this network.  | Fund it with testnet Friendbot, then call `refetch()`.                    |
| `NETWORK_ERROR`     | Horizon is unreachable.                     | Check the configured Horizon URL and the connection, then `refetch()`.    |
| `RATE_LIMITED`      | Horizon returned a 429 and retries ran out. | Wait before calling `refetch()`; do not call `fetchNext` in a tight loop. |

## Notes

- Without an `address`, the composable follows the runtime's connected wallet address.
- Only the first page is cached in the shared store. Pages reached with `fetchNext` or `fetchPrev` are not.
- A page navigation that comes back empty keeps the page already on screen.
- A navigation request superseded by a newer one, a `refetch`, or a key change is discarded.

## Differences from React

Vue accepts refs and getters for every option and returns computed refs. React's `usePayments` takes and returns plain values.

## Related hooks

- [React `usePayments`](../hooks/use-payments.md) - the equivalent React API.
- [`usePaymentHistory`](./use-payment-history.md) - the same pages, filtered by direction or asset.
- [`useSendPayment`](./use-send-payment.md) - sends a new payment.
