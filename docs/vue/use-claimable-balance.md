# useClaimableBalance

Lists the claimable balances an account can claim, through the shared Vue cache.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useClaimableBalance } from "@use-stellar/vue"
```

## Basic usage

```vue
<script setup lang="ts">
import { useClaimableBalance } from "@use-stellar/vue"

const { balances, loading, error } = useClaimableBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Could not load claimable balances.</p>
  <ul v-else>
    <li v-for="balance in balances" :key="balance.id">{{ balance.amount }} {{ balance.asset }}</li>
  </ul>
</template>
```

## Parameters

| Parameter   | Type                                            | Required | Default                  | Description                                                              |
| ----------- | ----------------------------------------------- | -------- | ------------------------ | ------------------------------------------------------------------------ |
| `address`   | `MaybeRefOrGetter<string \| null \| undefined>` | No       | Connected wallet address | A static address, ref, or getter. Empty values keep the composable idle. |
| `staleTime` | `MaybeRefOrGetter<number \| undefined>`         | No       | Plugin setting           | Milliseconds before cached results become stale.                         |

Leaving `address` out follows the runtime's connected wallet address. Passing `null` or an empty string keeps the composable idle.

## Return values

| Property   | Type                                | Description                                              |
| ---------- | ----------------------------------- | -------------------------------------------------------- |
| `balances` | `ComputedRef<ClaimableBalance[]>`   | Claimable balances for the address. Empty while loading. |
| `loading`  | `ComputedRef<boolean>`              | `true` while the request is running.                     |
| `error`    | `ComputedRef<StellarError \| null>` | The request failure, or `null`.                          |
| `refetch`  | `() => Promise<void>`               | Forces a fresh request.                                  |

### `ClaimableBalance`

| Field       | Type                         | Description                                    |
| ----------- | ---------------------------- | ---------------------------------------------- |
| `id`        | `string`                     | The claimable balance ID.                      |
| `asset`     | `string`                     | The asset as Horizon reports it.               |
| `amount`    | `string`                     | The claimable amount.                          |
| `claimants` | `ClaimableBalanceClaimant[]` | Each claimant's `destination` and `predicate`. |
| `sponsor`   | `string \| undefined`        | The sponsoring account, when there is one.     |

## Examples

### Example 1 - the common case

```vue
<script setup lang="ts">
import { useClaimableBalance } from "@use-stellar/vue"

const { balances } = useClaimableBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <output>{{ balances.length }} claimable</output>
</template>
```

### Example 2 - follow the connected wallet

With no `address`, the composable reads the runtime's wallet address and reloads when it changes.

```vue
<script setup lang="ts">
import { useClaimableBalance } from "@use-stellar/vue"

const { balances, loading } = useClaimableBalance()
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else>{{ balances.length }} waiting for you</p>
</template>
```

### Example 3 - handling errors and retrying

```vue
<script setup lang="ts">
import { useClaimableBalance } from "@use-stellar/vue"

const { balances, error, refetch } = useClaimableBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <div v-if="error">
    <p>{{ error.message }}</p>
    <button type="button" @click="refetch">Try again</button>
  </div>
  <p v-else>{{ balances.length }} claimable</p>
</template>
```

## TypeScript

```ts
interface UseClaimableBalanceOptions {
  address?: MaybeRefOrGetter<string | null | undefined>
  staleTime?: MaybeRefOrGetter<number | undefined>
}

interface UseClaimableBalanceReturn {
  balances: ComputedRef<ClaimableBalance[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}
```

## Common errors

| Error code      | Cause                   | Fix                                                 |
| --------------- | ----------------------- | --------------------------------------------------- |
| `NETWORK_ERROR` | Horizon is unreachable. | Check the configured Horizon URL, then `refetch()`. |
| `RATE_LIMITED`  | Horizon returned a 429. | Wait before calling `refetch()`.                    |

## Notes

- Calls with the same cache key share in-flight work through the installed runtime.
- An address that is empty after trimming is idle: no request, no error, and `loading` is `false`.

## Differences from React

Vue accepts a static address, a `ref`, or a getter, and returns computed refs. Read them with `.value` in scripts; templates unwrap them.

## Related hooks

- [React `useClaimableBalance`](../hooks/use-claimable-balance.md) - the equivalent React API.
- [`useBalance`](./use-balance.md) - the account's spendable balances.
