# useFeeStats

Fetches Horizon fee statistics for the active network through the shared Vue cache, enabling fee estimation for Stellar transactions.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useFeeStats } from "@use-stellar/vue"
```

## Basic usage

This component reads the current network fee statistics on testnet.

```vue
<script setup lang="ts">
import { useFeeStats } from "@use-stellar/vue"

const { suggested, isSurging, loading, error } = useFeeStats()
</script>

<template>
  <p v-if="loading">Loading fee stats...</p>
  <p v-else-if="error">Could not load fee stats.</p>
  <div v-else>
    <p v-if="isSurging">Network is surging ⚡</p>
    <p>Suggested normal fee: {{ suggested("normal") }} stroops</p>
    <p>Suggested high fee: {{ suggested("high") }} stroops</p>
  </div>
</template>
```

## Parameters

| Parameter | Type                      | Required | Default | Description                                                   |
| --------- | ------------------------- | -------- | ------- | ------------------------------------------------------------- |
| `options` | `UseFeeStatsOptions`      | No       | `{}`    | Optional configuration; see details below.                    |

The options object accepts:

| Property  | Type    | Default | Description                                                  |
| --------- | ------- | ------- | ------------------------------------------------------------ |
| (unused)  | -       | -       | Currently no Vue-specific options; options are reserved for future use. |

## Return values

| Property      | Type                                                      | Description                                                                      |
| ------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `baseFee`     | `ComputedRef<string>`                                     | The network's current base fee in stroops.                                       |
| `percentiles` | `ComputedRef<Record<"p10"\|"p50"\|"p90"\|"p95"\|"p99", string>>` | Charged-fee percentiles from the last 5 ledgers, in stroops.            |
| `isSurging`   | `ComputedRef<boolean>`                                    | `true` when the network is experiencing congestion.                              |
| `suggested`   | `(urgency?: "low" \| "normal" \| "high") => string`      | Returns a max-fee bid: low → p50, normal → p90, high → p99 of `fee_charged`.   |
| `loading`     | `ComputedRef<boolean>`                                    | `true` while the request is running.                                             |
| `error`       | `ComputedRef<StellarError \| null>`                       | The request failure, or `null`.                                                  |
| `lastUpdated` | `ComputedRef<Date \| null>`                               | Timestamp of the last successful fetch, or `null`.                               |
| `refetch`     | `() => Promise<void>`                                     | Forces a fresh fee-stats request.                                                |

## Examples

### Example 1 - fee estimation for a payment

Display fee options to the user based on urgency.

```vue
<script setup lang="ts">
import { useFeeStats } from "@use-stellar/vue"

const { suggested, loading, error } = useFeeStats()
</script>

<template>
  <div v-if="loading">Fetching fee estimates...</div>
  <div v-else-if="error">Could not fetch fee estimates.</div>
  <div v-else>
    <p>
      <label>
        <input type="radio" value="low" /> Low: {{ suggested("low") }} stroops
      </label>
    </p>
    <p>
      <label>
        <input type="radio" value="normal" checked /> Normal: {{ suggested("normal") }} stroops
      </label>
    </p>
    <p>
      <label>
        <input type="radio" value="high" /> High: {{ suggested("high") }} stroops
      </label>
    </p>
  </div>
</template>
```

### Example 2 - detect and notify during network surge

Alert the user when the network is congested.

```vue
<script setup lang="ts">
import { useFeeStats } from "@use-stellar/vue"

const { isSurging, suggested } = useFeeStats()
</script>

<template>
  <div v-if="isSurging" class="alert">
    <p>⚠ Network is surging. Consider using a higher fee:</p>
    <p>{{ suggested("high") }} stroops</p>
  </div>
</template>
```

### Example 3 - manual refetch

Refresh fee statistics on demand.

```vue
<script setup lang="ts">
import { useFeeStats } from "@use-stellar/vue"

const { baseFee, refetch } = useFeeStats()

async function updateFees() {
  await refetch()
}
</script>

<template>
  <div>
    <p>Current base fee: {{ baseFee }} stroops</p>
    <button type="button" @click="updateFees">Refresh</button>
  </div>
</template>
```

## TypeScript

```ts
interface UseFeeStatsReturn {
  baseFee: ComputedRef<string>
  percentiles: ComputedRef<{
    p10: string
    p50: string
    p90: string
    p95: string
    p99: string
  }>
  isSurging: ComputedRef<boolean>
  suggested: (urgency?: "low" | "normal" | "high") => string
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  lastUpdated: ComputedRef<Date | null>
  refetch: () => Promise<void>
}
```

## Common errors

| Error                            | Cause                                 | Fix                                                    |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| Network error                    | Horizon is unavailable or blocked.    | Check the configured Horizon URL and retry.            |
| `suggested()` throws an error    | Fee stats have not loaded yet.        | Wait until `loading.value` is `false`.                 |
| `lastUpdated` is `null`          | No successful fetch has completed yet. | Wait for the first request or retry with `refetch()`. |

## Notes

- Fee stats are network-wide and refresh with each ledger (typically every ~5 seconds).
- `suggested()` returns a **maximum bid**, not the actual fee. The network takes only what the ledger needs.
- Calls with the same cache key share in-flight work through the installed runtime, so multiple components requesting fee stats at the same time make only one request.
- These are **Horizon inclusion fees**. Soroban resource fees come from contract simulation, not this endpoint.
- Run the composable during component setup or inside an effect scope so subscriptions are disposed.

## Differences from React

Vue returns state as computed refs, so read it with `.value` in scripts; templates unwrap it automatically. The Vue composable does not support polling (`watch` / `interval` options); instead, call `refetch()` manually or use a `setInterval` in your component if needed.

## Related hooks

- [React `useFeeStats`](../hooks/use-fee-stats.md) - the equivalent React API.
- [`sendPayment`](./use-send-payment.md) - builds and submits a payment using a fee from `suggested()`.
