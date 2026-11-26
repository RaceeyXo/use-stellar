# usePaymentPaths

Finds routes and quotes for converting one asset into another using Stellar's path-finding endpoints. Results are cached and deduplicated across components.

## Overview

`usePaymentPaths` queries Horizon's strict-send or strict-receive path endpoints to discover conversion routes between two assets. It returns a list of possible paths sorted by exchange rate (best first), along with the exact amounts you'll send and receive on each route.

Results are cached in the shared `QueryStore`, so:
- Two components asking for the same route make only one request
- The cache respects stale-time and error recovery
- Different Vue and React consumers of the same data share one cache entry

Use `usePaymentPaths` with [`usePathPayment`](/vue/use-path-payment.md) to send or receive funds along a discovered route.

## Basic Usage

```ts
import { usePaymentPaths } from '@use-stellar/vue'

// Find routes to convert 100 XLM to USDC
const { paths, loading, error } = usePaymentPaths({
  mode: "strictSend",
  sourceAsset: "XLM",
  sourceAmount: "100",
  destinationAsset: { 
    code: "USDC", 
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" 
  },
})

// Best route is first
const best = computed(() => paths.value[0])
```

## Options

### mode: "strictSend" or "strictReceive"

Discriminates which amount is fixed and which is a quote:

#### strictSend
Pin what you send; the destination amount is a quote.

```ts
const { paths } = usePaymentPaths({
  mode: "strictSend",
  sourceAsset: "XLM",
  sourceAmount: "100",          // You send exactly 100 XLM
  destinationAsset: { code: "USDC", issuer: "..." },
  // paths[0].destinationAmount tells you what arrives
})
```

#### strictReceive
Pin what the recipient gets; your amount is a quote.

```ts
const { paths } = usePaymentPaths({
  mode: "strictReceive",
  sourceAsset: "XLM",
  destinationAsset: { code: "USDC", issuer: "..." },
  destinationAmount: "95",      // Recipient gets exactly 95 USDC
  // paths[0].sourceAmount tells you what you must send
})
```

### sourceAsset
The asset you are sending. Either `"XLM"` (string) or an object: `{ code: string, issuer: string }`.

### destinationAsset
The asset the recipient is getting. Either `"XLM"` (string) or an object: `{ code: string, issuer: string }`.

### sourceAmount (strictSend)
Exact amount you will send, as a decimal string (e.g., `"100.50"`).

### destinationAmount (strictReceive)
Exact amount the recipient will receive, as a decimal string (e.g., `"95.25"`).

### destinationAddress? (strictSend)
Optional Stellar address. When provided, Horizon restricts results to assets this account can actually receive — which is usually what a UI needs.

### sourceAddress? (strictReceive)
Optional Stellar address. When provided, Horizon restricts results to assets this account holds, so every quote is one you can pay with.

### enabled?
Boolean to enable or disable the query (default `true`). When `false`, no request is made and `loading` is `false`.

### watch?
Boolean to re-fetch quotes on an interval (default `false`). Useful for a real-time quote UI. Polls only when the app is focused; pauses when backgrounded and refreshes on return.

### interval?
Polling interval in milliseconds when `watch` is `true` (default `10000`).

## Return Value

```ts
interface UsePaymentPathsReturn {
  /** Candidate routes, best rate first. Empty if no route exists. */
  paths: ComputedRef<PaymentPath[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  /** When the current `paths` were fetched. Quotes go stale in seconds. */
  lastUpdated: ComputedRef<Date | null>
  /** Manually refetch the current options. */
  refetch: () => Promise<void>
}
```

### PaymentPath

```ts
interface PaymentPath {
  /** Intermediate hops. Empty if a direct market exists. */
  path: Asset[]
  /** Amount leaving your account (exactin strictSend mode, a quote in strictReceive). */
  sourceAmount: string
  /** Amount arriving at destination (exact in strictReceive mode, a quote in strictSend). */
  destinationAmount: string
  /** Exchange rate: destinationAmount / sourceAmount, as a precise decimal. */
  rate: string
}
```

## Example: Quote UI with Path Payment

```vue
<script setup lang="ts">
import { computed, ref } from "vue"
import { usePaymentPaths, usePathPayment } from "@use-stellar/vue"

const TESTNET_USDC = { 
  code: "USDC", 
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" 
}

const sendAmount = ref("100")
const selectedPath = ref<number>(0)

// Find routes to convert our input amount to USDC
const { paths, loading, error } = usePaymentPaths({
  mode: "strictSend",
  sourceAsset: "XLM",
  sourceAmount: sendAmount,
  destinationAsset: TESTNET_USDC,
})

// The best route
const best = computed(() => paths.value[selectedPath.value])

// Send funds along the selected route
const { invoke, result } = usePathPayment({
  mode: "strictSend",
  sourceAsset: "XLM",
  sourceAmount: sendAmount,
  destinationAsset: TESTNET_USDC,
  path: computed(() => best.value?.path ?? []),
})

async function sendPayment() {
  try {
    await invoke()
    sendAmount.value = ""
  } catch (err) {
    console.error("Payment failed", err)
  }
}
</script>

<template>
  <div>
    <input v-model="sendAmount" type="number" placeholder="XLM to send" />
    
    <div v-if="loading">Loading routes...</div>
    <div v-else-if="error">{{ error.message }}</div>
    <div v-else-if="paths.length === 0">No routes found</div>
    
    <div v-else>
      <div v-for="(path, i) in paths" :key="i">
        <label>
          <input 
            v-model.number="selectedPath" 
            type="radio" 
            :value="i"
          />
          Send {{ path.sourceAmount }} XLM → Get {{ path.destinationAmount }} USDC
          (Rate: {{ path.rate }})
        </label>
      </div>
    </div>

    <button 
      @click="sendPayment"
      :disabled="!best || result?.loading"
    >
      {{ result?.loading ? "Sending..." : "Send" }}
    </button>
  </div>
</template>
```

## Error Handling

Errors are typed `StellarError` with one of these codes:

- `"NOT_FOUND"` (404): No route exists between the two assets.
- `"RATE_LIMIT"` (429): Horizon is rate-limiting. Retries respect `Retry-After`.
- `"NETWORK_ERROR"`: Network failure or server error.
- `"VALIDATION_ERROR"`: Invalid options (missing required amount, malformed asset).

```ts
const { paths, error } = usePaymentPaths(options)

if (error.value?.code === "NOT_FOUND") {
  // No route exists
}
```

## Reactivity

Options accept static values, refs, or getters (`MaybeRefOrGetter`):

```ts
const sourceAmount = ref("100")

// All three work:
usePaymentPaths({
  sourceAmount: "100",              // static
  sourceAmount: sourceAmount,        // ref
  sourceAmount: () => sourceAmount.value,  // getter
})

// Changing the ref refetches with new options:
sourceAmount.value = "200"
```

## Testing

Use `createStellarTestHarness` from `@use-stellar/vue/test-utils`:

```ts
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"
import { usePaymentPaths } from "@use-stellar/vue"

const harness = createStellarTestHarness({ network: "testnet" })

const result = harness.run(() =>
  usePaymentPaths({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: { code: "USDC", issuer: "..." },
  })
)

// Assert on result.paths.value, result.loading.value, etc.

harness.dispose()
```

See [`useBalance`](/vue/use-balance.md) for more testing patterns.
