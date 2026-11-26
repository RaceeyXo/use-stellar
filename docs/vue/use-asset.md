# useAsset

Asset metadata (supply, holder count, flags) for a testnet issued asset. Readers share the React hook's cache key.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `code` | `MaybeRefOrGetter<string \| null \| undefined>` | — | Asset code, such as `USDC`. Empty disables the query. |
| `issuer` | `MaybeRefOrGetter<string \| null \| undefined>` | — | Issuer account. Empty disables the query. |
| `autoFetch` | `MaybeRefOrGetter<boolean \| undefined>` | `true` | `false` skips the request until `refetch()`. |
| `staleTime` | `MaybeRefOrGetter<number \| undefined>` | Plugin setting | Milliseconds before the cached result is stale. |
| `maxRetries` | `MaybeRefOrGetter<number \| undefined>` | `3` | Retries after a 429. |

## Return values

| Property | Type | Description |
| --- | --- | --- |
| `asset` | `ComputedRef<AssetInfo \| null>` | Supply, flags, and optional home domain. |
| `loading` | `ComputedRef<boolean>` | `true` while the request is in flight. |
| `error` | `ComputedRef<StellarError \| null>` | `ACCOUNT_NOT_FOUND`, `RATE_LIMITED`, or `NETWORK_ERROR`. |
| `refetch` | `() => Promise<void>` | Forces a new request. |

## Example

```vue
<script setup lang="ts">
import { useAsset } from "@use-stellar/vue"

const { asset, loading, error } = useAsset({
  code: "USDC",
  issuer: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">{{ error.code }}</p>
  <p v-else>Supply {{ asset?.supply }}</p>
</template>
```
