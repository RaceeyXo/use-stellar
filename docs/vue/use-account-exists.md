# useAccountExists

Whether a testnet address is funded. A missing account is `exists: false` with `error: null`, not a failed request. The composable uses the same cache key as the React hook.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `address` | `MaybeRefOrGetter<string \| null \| undefined>` | Connected wallet | Empty or `null` keeps the composable idle. |
| `staleTime` | `MaybeRefOrGetter<number \| undefined>` | Plugin setting | Milliseconds before the cached result is stale. |
| `maxRetries` | `MaybeRefOrGetter<number \| undefined>` | `3` | Retries after a 429. `0` disables them. |

## Return values

| Property | Type | Description |
| --- | --- | --- |
| `exists` | `ComputedRef<boolean \| null>` | `true` when funded, `false` when missing or malformed, `null` while idle. |
| `reason` | `ComputedRef<"exists" \| "not_funded" \| "invalid_format" \| "idle">` | Why `exists` has that value. |
| `loading` | `ComputedRef<boolean>` | `true` while the request is in flight. |
| `error` | `ComputedRef<StellarError \| null>` | A 429 is `RATE_LIMITED`. A transport failure is `NETWORK_ERROR`. |
| `refetch` | `() => Promise<void>` | Forces a new request. |

## Example

```vue
<script setup lang="ts">
import { useAccountExists } from "@use-stellar/vue"

const { exists, error } = useAccountExists({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="error">{{ error.code }}</p>
  <p v-else>{{ exists === false ? "Not funded on testnet" : "Funded" }}</p>
</template>
```
