# useTrades

Fetches executed trades (fills) from Horizon with pagination support. Filter by account, asset pair, or both. Each trade is normalized so that the base asset always corresponds to the asset you requested (when filtering by asset pair).

## Options

```typescript
interface UseTradesOptions {
  /**
   * Stellar account address. When provided, only trades involving this
   * account are returned. Also used to derive `side` on each trade.
   * Defaults to the connected wallet address if omitted.
   */
  address?: MaybeRefOrGetter<string | null | undefined>

  /**
   * The asset you want on the base side of every returned trade.
   * Must be paired with `counterAsset`. Together they filter to a specific
   * orderbook and also define the normalized orientation rule.
   */
  baseAsset?: Asset | null

  /**
   * The asset you want on the counter side of every returned trade.
   * Must be paired with `baseAsset`.
   */
  counterAsset?: Asset | null

  /** Number of trades per page (default 10). */
  limit?: MaybeRefOrGetter<number>

  /** Sort order (default `"desc"` — most recent first). */
  order?: MaybeRefOrGetter<"asc" | "desc">

  /** Retries after a rate limit (429), honouring `Retry-After`. */
  maxRetries?: MaybeRefOrGetter<number | undefined>
}
```

## Return Value

```typescript
interface UseTradesReturn {
  /** Array of normalized trades. */
  trades: ComputedRef<NormalizedTrade[]>

  /** Loading state while fetching. */
  loading: ComputedRef<boolean>

  /** Error state, if any. */
  error: ComputedRef<StellarError | null>

  /** Force a fresh fetch from Horizon. */
  refetch: () => Promise<void>

  /** `true` when a next page is available. */
  hasNext: ComputedRef<boolean>

  /** `true` when a previous page is available. */
  hasPrev: ComputedRef<boolean>

  /** Load the next page of trades. */
  fetchNext: () => Promise<void>

  /** Load the previous page of trades. */
  fetchPrev: () => Promise<void>
}
```

## Usage

### Fetch trades by account

```vue
<script setup>
import { useTrades } from '@use-stellar/vue'

const { trades, loading, error, fetchNext, hasNext } = useTrades({
  address: 'GDZST3XVCDTUJ76ZAV2HA72KYRF5UJZJ2QQRVEICVQ5XGIPK6BFQJFWF',
})
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>
    <div v-for="trade in trades" :key="trade.id">
      {{ trade.baseAsset }} → {{ trade.counterAsset }} @ {{ trade.price }}
    </div>
    <button v-if="hasNext" @click="fetchNext">Load more</button>
  </div>
</template>
```

### Fetch trades for an asset pair

```vue
<script setup>
import { useTrades } from '@use-stellar/vue'

const { trades } = useTrades({
  baseAsset: 'XLM',
  counterAsset: {
    code: 'USDC',
    issuer: 'GDZST3XVCDTUJ76ZAV2HA72KYRF5UJZJ2QQRVEICVQ5XGIPK6BFQJFWF',
  },
  limit: 20,
  order: 'asc',
})
</script>

<template>
  <div>
    <div v-for="trade in trades" :key="trade.id">
      {{ trade.baseAmount }} XLM ↔ {{ trade.counterAmount }} USDC
    </div>
  </div>
</template>
```

### Use reactive options

```vue
<script setup>
import { ref } from 'vue'
import { useTrades } from '@use-stellar/vue'

const limit = ref(10)
const order = ref('desc')

const { trades, refetch } = useTrades({
  address: 'GDZST3XVCDTUJ76ZAV2HA72KYRF5UJZJ2QQRVEICVQ5XGIPK6BFQJFWF',
  limit,
  order,
})

// Change any reactive option to automatically refetch
const toggleSort = () => {
  order.value = order.value === 'asc' ? 'desc' : 'asc'
}
</script>

<template>
  <button @click="toggleSort">Toggle sort</button>
  <div v-for="trade in trades" :key="trade.id">{{ trade.price }}</div>
</template>
```

## Base/Counter Orientation

When you filter by `baseAsset` and `counterAsset`, Horizon may return the record with the pair in the opposite order (due to its canonical asset ordering). This composable automatically flips base and counter and inverts the price rational so every record is consistently oriented with your requested base asset.

When no `baseAsset` is supplied (account-only filter), the canonical Horizon orientation is preserved.

## Cache Sharing

All Vue and React instances reading the same account, asset pair, and parameters share a single cache entry and one request. The query store deduplicates in-flight requests and respects stale-time and error codes.

## Pagination

Pagination uses cursor-based navigation. The `nextCursor` and `prevCursor` returned by Horizon embed the correct paging token. Cursors are automatically cleared when query parameters change, so navigating to a new account or asset pair always starts from page one.
