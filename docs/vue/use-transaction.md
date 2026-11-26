# useTransaction

A transaction's status by hash on testnet. With `watch: true` it polls every 3 seconds until the status is `success` or `failed`, then stops. Disposing the component stops the timer.

A missing hash is `not_found` with `error: null` when Horizon returns 404. A 429 is `RATE_LIMITED`. A transport failure is `NETWORK_ERROR`.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `hash` | `MaybeRefOrGetter<string \| null \| undefined>` | — | Transaction hash. Empty disables the query. |
| `watch` | `MaybeRefOrGetter<boolean \| undefined>` | `false` | Poll until the transaction is final. |
| `staleTime` | `MaybeRefOrGetter<number \| undefined>` | Plugin setting | Milliseconds before the cached result is stale. |
| `maxRetries` | `MaybeRefOrGetter<number \| undefined>` | `3` | Retries after a 429. |

## Return values

| Property | Type | Description |
| --- | --- | --- |
| `transaction` | `ComputedRef<TransactionResult \| null>` | Status and, once included, ledger, fee, and envelope. |
| `loading` | `ComputedRef<boolean>` | `true` while a request is in flight. |
| `error` | `ComputedRef<StellarError \| null>` | Typed failure, or `null`. |
| `refetch` | `() => Promise<void>` | Forces a new request. |

## Example

```vue
<script setup lang="ts">
import { useTransaction } from "@use-stellar/vue"

const { transaction, error } = useTransaction({
  hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  watch: true,
})
</script>

<template>
  <p v-if="error">{{ error.code }}</p>
  <p v-else>Status {{ transaction?.status }}</p>
</template>
```
