# useBalance

Fetches the XLM or issued-asset balance of a Stellar account through the shared Vue cache.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useBalance } from "@use-stellar/vue"
```

## Basic usage

This component reads an account's testnet XLM balance.

```vue
<script setup lang="ts">
import { useBalance } from "@use-stellar/vue"

const { balance, loading, error } = useBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Could not load the balance.</p>
  <p v-else>{{ balance ?? "0" }} XLM</p>
</template>
```

## Parameters

| Parameter   | Type                                            | Required | Default        | Description                                                                  |
| ----------- | ----------------------------------------------- | -------- | -------------- | ---------------------------------------------------------------------------- |
| `address`   | `MaybeRefOrGetter<string \| null \| undefined>` | Yes      | -              | A static address, Vue ref, or getter. Empty values keep the composable idle. |
| `asset`     | `Asset`                                         | No       | `"XLM"`        | The native asset or an issued `{ code, issuer }` asset.                      |
| `staleTime` | `number`                                        | No       | Plugin setting | Milliseconds before cached account data becomes stale.                       |

## Return values

| Property   | Type                          | Description                                        |
| ---------- | ----------------------------- | -------------------------------------------------- |
| `balance`  | `ComputedRef<string \| null>` | The selected asset balance, or `null` when absent. |
| `balances` | `ComputedRef<Balance[]>`      | Every normalized balance on the account.           |
| `loading`  | `ComputedRef<boolean>`        | `true` while the account request is running.       |
| `error`    | `ComputedRef<unknown>`        | The request failure, or `null`.                    |
| `refetch`  | `() => void`                  | Forces a fresh account request.                    |

## Examples

### Example 1 - the common case

Read XLM from a funded testnet account.

```vue
<script setup lang="ts">
import { useBalance } from "@use-stellar/vue"

const { balance } = useBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <output>{{ balance ?? "0" }} XLM</output>
</template>
```

### Example 2 - reactive input and issued asset

A getter is re-evaluated when its Vue dependencies change.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useBalance } from "@use-stellar/vue"

const address = ref("GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS")
const { balance } = useBalance({
  address: () => address.value,
  asset: {
    code: "USDC",
    issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
  },
})
</script>

<template>
  <output>{{ balance ?? "No trustline" }} USDC</output>
</template>
```

### Example 3 - handling errors and retrying

```vue
<script setup lang="ts">
import { useBalance } from "@use-stellar/vue"

const { balance, error, refetch } = useBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <div v-if="error">
    <p>Balance lookup failed.</p>
    <button type="button" @click="refetch">Try again</button>
  </div>
  <output v-else>{{ balance ?? "0" }} XLM</output>
</template>
```

## TypeScript

```ts
interface UseBalanceReturn {
  balance: ComputedRef<string | null>
  balances: ComputedRef<Balance[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<unknown>
  refetch: () => void
}
```

## Common errors

| Error               | Cause                                               | Fix                                                          |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Account not found   | The address is not funded on testnet.               | Fund it with testnet Friendbot, then call `refetch()`.       |
| Network error       | Horizon is unavailable or blocked.                  | Check the configured Horizon URL and retry.                  |
| `balance` is `null` | The account has no matching issued-asset trustline. | Confirm the code and issuer, then add a trustline if needed. |

## Notes

- An empty address is idle: no request, no error, and `loading` is `false`.
- Calls with the same cache key share in-flight work through the installed runtime.
- Run the composable during component setup or inside an effect scope so subscriptions are disposed.

## Differences from React

Vue accepts a static address, a `ref`, or a getter. Returned state is exposed as computed refs, so read it with `.value` in scripts; templates unwrap it automatically.

## Related hooks

- [React `useBalance`](../hooks/use-balance.md) - the equivalent React API.
- [`useAddTrustline`](./use-add-trustline.md) - creates an issued-asset balance line.
