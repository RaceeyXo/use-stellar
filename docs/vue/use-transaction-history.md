# useTransactionHistory

Reads an account's transactions from Horizon one page at a time, through the shared Vue cache.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useTransactionHistory } from "@use-stellar/vue"
```

## Basic usage

This component lists the ten most recent transactions of a testnet account.

```vue
<script setup lang="ts">
import { useTransactionHistory } from "@use-stellar/vue"

const { transactions, loading, error } = useTransactionHistory({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Could not load the transactions.</p>
  <ul v-else>
    <li v-for="tx in transactions" :key="tx.hash">{{ tx.createdAt }} - {{ tx.hash }}</li>
  </ul>
</template>
```

## Parameters

Every option accepts a plain value, a `ref` or a getter.

| Parameter    | Type                                             | Required | Default          | Description                                                                                                       |
| ------------ | ------------------------------------------------ | -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `address`    | `MaybeRefOrGetter<string \| null \| undefined>`  | No       | Connected wallet | The account to read. Leave it out to follow the connected wallet. `null` or an empty string keeps the query idle. |
| `limit`      | `MaybeRefOrGetter<number \| undefined>`          | No       | `10`             | Transactions per page.                                                                                            |
| `order`      | `MaybeRefOrGetter<"asc" \| "desc" \| undefined>` | No       | `"desc"`         | `"desc"` lists the most recent transaction first.                                                                 |
| `cursor`     | `MaybeRefOrGetter<string \| undefined>`          | No       | -                | A Horizon paging token. The first page starts after it.                                                           |
| `maxRetries` | `MaybeRefOrGetter<number \| undefined>`          | No       | `3`              | How many times a rate-limited request for the first page is tried again.                                          |

## Return values

| Property       | Type                                   | Description                                                                |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `transactions` | `ComputedRef<NormalizedTransaction[]>` | The page on screen. Empty while idle and until a first page arrives.       |
| `loading`      | `ComputedRef<boolean>`                 | `true` while the first page or a later page is being fetched.              |
| `error`        | `ComputedRef<StellarError \| null>`    | The failure of the last request, or `null`.                                |
| `isStale`      | `ComputedRef<boolean>`                 | `true` when `error` is set while a page fetched earlier is still shown.    |
| `refetch`      | `() => Promise<void>`                  | Fetches the first page again and returns to it.                            |
| `fetchNext`    | `() => Promise<void>`                  | Loads the next page. Does nothing while there is no page to step from.     |
| `fetchPrev`    | `() => Promise<void>`                  | Loads the previous page. Does nothing while there is no page to step from. |
| `hasNext`      | `ComputedRef<boolean>`                 | Whether Horizon returned a record beyond the page shown.                   |
| `hasPrev`      | `ComputedRef<boolean>`                 | Whether there is a page before the one shown.                              |

### `NormalizedTransaction` shape

| Field            | Type                  | Description                                              |
| ---------------- | --------------------- | -------------------------------------------------------- |
| `hash`           | `string`              | The transaction hash.                                    |
| `ledger`         | `number`              | The ledger the transaction was included in.              |
| `createdAt`      | `string`              | ISO 8601 timestamp from Horizon.                         |
| `sourceAccount`  | `string`              | The transaction's source account.                        |
| `fee`            | `string`              | The fee charged, in stroops.                             |
| `operationCount` | `number`              | How many operations the transaction holds.               |
| `successful`     | `boolean`             | Whether the transaction was applied to the ledger.       |
| `memo`           | `string \| undefined` | The memo, if there is one.                               |
| `memoType`       | `string \| undefined` | The memo type, for example `"text"`, `"id"` or `"hash"`. |

## Examples

### Example 1 - paging through the connected wallet's history

With no `address`, the composable follows the connected wallet and is idle while none is connected.

```vue
<script setup lang="ts">
import { useTransactionHistory } from "@use-stellar/vue"

const { transactions, loading, error, hasNext, hasPrev, fetchNext, fetchPrev } =
  useTransactionHistory({ limit: 5 })
</script>

<template>
  <p v-if="error">Could not load the transactions.</p>
  <ul>
    <li v-for="tx in transactions" :key="tx.hash">
      {{ new Date(tx.createdAt).toLocaleString() }} - {{ tx.operationCount }} operation(s)
      <span v-if="!tx.successful">(failed)</span>
    </li>
  </ul>
  <button type="button" :disabled="!hasPrev || loading" @click="fetchPrev">Previous</button>
  <button type="button" :disabled="!hasNext || loading" @click="fetchNext">Next</button>
</template>
```

### Example 2 - reactive account and page size

A ref or a getter is read again when it changes, and the list starts over from the first page.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useTransactionHistory } from "@use-stellar/vue"

const ACCOUNTS = [
  "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
  "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
]
const address = ref(ACCOUNTS[0])
const pageSize = ref(10)
const { transactions } = useTransactionHistory({
  address,
  limit: () => pageSize.value,
  order: "asc",
})
</script>

<template>
  <button v-for="account in ACCOUNTS" :key="account" type="button" @click="address = account">
    {{ account.slice(0, 6) }}
  </button>
  <select v-model.number="pageSize" aria-label="Page size">
    <option :value="10">10</option>
    <option :value="25">25</option>
  </select>
  <p>{{ transactions.length }} transactions, oldest first</p>
</template>
```

### Example 3 - handling errors and retrying

`error` is a typed `StellarError`, so the template can branch on its `code`.

```vue
<script setup lang="ts">
import { useTransactionHistory } from "@use-stellar/vue"

const { transactions, error, isStale, refetch } = useTransactionHistory({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <div v-if="error">
    <p v-if="error.code === 'ACCOUNT_NOT_FOUND'">This account is not funded on testnet yet.</p>
    <p v-else-if="error.code === 'RATE_LIMITED'">Horizon is rate limiting. Try again shortly.</p>
    <p v-else>Could not load the transactions.</p>
    <p v-if="isStale">The list below was loaded earlier.</p>
    <button type="button" @click="refetch">Try again</button>
  </div>
  <ul>
    <li v-for="tx in transactions" :key="tx.hash">{{ tx.hash }}</li>
  </ul>
</template>
```

## Pagination behaviour

- The composable asks Horizon for one record more than `limit`. `hasNext` is `true` when that extra record came back. It is not shown.
- `hasPrev` is `false` on the first page unless a `cursor` was given, and `true` after `fetchNext`.
- `fetchNext` and `fetchPrev` follow the `next` and `prev` links of the page that was fetched, as `usePayments` does. Only the first page is cached and shared. Later pages are fetched each time.
- Stepping past the last page keeps the page on screen and sets `hasNext` to `false`.
- Changing `address`, `limit` or `order` starts again from the first page. The `cursor` given before is dropped, and a new one applies when `cursor` itself changes.
- `refetch()` returns to the first page too.
- When requests overlap, only the latest one is shown.

## TypeScript

```ts
interface UseTransactionHistoryOptions {
  address?: MaybeRefOrGetter<string | null | undefined>
  limit?: MaybeRefOrGetter<number | undefined>
  order?: MaybeRefOrGetter<"asc" | "desc" | undefined>
  cursor?: MaybeRefOrGetter<string | undefined>
  maxRetries?: MaybeRefOrGetter<number | undefined>
}

interface UseTransactionHistoryReturn {
  transactions: ComputedRef<NormalizedTransaction[]>
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

| Error code          | Cause                                            | Fix                                                             |
| ------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `ACCOUNT_NOT_FOUND` | Horizon answered 404: the account is not funded. | Fund it with testnet Friendbot, then call `refetch()`.          |
| `RATE_LIMITED`      | Horizon answered 429.                            | Wait before calling `refetch()`, and do not page in a loop.     |
| `NETWORK_ERROR`     | Horizon could not be reached.                    | Check the connection and the configured Horizon URL, and retry. |

## Notes

- No address and no connected wallet is idle: no request, no error, and `loading` is `false`.
- Composables with the same account, `limit`, `order` and `cursor` share one request. The entry is stored under the key the React hook uses.
- Nothing is fetched during server rendering. The first request is made when the component mounts.
- `fee` is the fee charged, not the fee bid. One stroop is 0.0000001 XLM.
- Use `hash` as the `key` in `v-for`.
- Run the composable during component setup or inside an effect scope so subscriptions are disposed.

## Differences from React

- Every option accepts a static value, a `ref` or a getter. Returned state is exposed as computed refs, so read it with `.value` in scripts; templates unwrap it automatically.
- `isStale` and `maxRetries` are added, as in `usePayments`.
- `refetch` returns a promise.
- A new `address`, `limit` or `order` drops the `cursor`. The React hook keeps using the `cursor` it is given.

## Related hooks

- [React `useTransactionHistory`](../hooks/use-transaction-history.md) - the equivalent React API.
- [`useBalance`](./use-balance.md) - reads the same account's balances.
