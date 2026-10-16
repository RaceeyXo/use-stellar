# usePathPayment

Sends a slippage-bounded testnet path payment that converts one asset into another.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { usePathPayment } from "@use-stellar/vue"
```

## Basic usage

Call the action after the app has connected a wallet through the installed runtime.

```vue
<script setup lang="ts">
import { usePathPayment } from "@use-stellar/vue"

const { pathPayment, loading, error, result } = usePathPayment()

async function swap(): Promise<void> {
  await pathPayment({
    mode: "strictSend",
    destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
    sendAsset: "XLM",
    sendAmount: "10.0000000",
    destAsset: {
      code: "USDC",
      issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
    },
    destMin: "2.4000000",
    path: [],
  })
}
</script>

<template>
  <button type="button" :disabled="loading" @click="swap">Swap XLM for USDC</button>
  <p v-if="error">{{ error.message }}</p>
  <p v-if="result">Transaction: {{ result.hash }}</p>
</template>
```

## Parameters

`pathPayment(options)` accepts a discriminated union. The selected mode controls which amount and slippage bound are required.

| Parameter       | Strict send    | Strict receive    | Description                                                                            |
| --------------- | -------------- | ----------------- | -------------------------------------------------------------------------------------- |
| `mode`          | `"strictSend"` | `"strictReceive"` | Chooses which side of the conversion is exact.                                         |
| `destination`   | Required       | Required          | The recipient's Stellar address.                                                       |
| `sendAsset`     | Required       | Required          | The asset leaving the connected account.                                               |
| `sendAmount`    | Required       | Not accepted      | The exact amount to send.                                                              |
| `sendMax`       | Not accepted   | Required          | The maximum amount to send. This is the strict-receive slippage bound.                 |
| `destAsset`     | Required       | Required          | The asset the recipient receives.                                                      |
| `destMin`       | Required       | Not accepted      | The minimum amount to receive. This is the strict-send slippage bound.                 |
| `destAmount`    | Not accepted   | Required          | The exact amount the recipient receives.                                               |
| `path`          | Optional       | Optional          | Intermediate assets from a fresh path quote. An empty array means a direct conversion. |
| `memo`          | Optional       | Optional          | A text memo.                                                                           |
| `fee`           | Optional       | Optional          | An exact positive fee in stroops.                                                      |
| `feeMultiplier` | Optional       | Optional          | Multiplies Horizon's current base fee.                                                 |

## Return values

| Property      | Type                                                          | Description                                            |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `pathPayment` | `(options: PathPaymentOptions) => Promise<TransactionResult>` | Builds, signs, and submits the bounded conversion.     |
| `loading`     | `Ref<boolean>`                                                | `true` only while the latest request is running.       |
| `error`       | `ShallowRef<StellarError \| null>`                            | The latest transaction failure.                        |
| `result`      | `ShallowRef<TransactionResult \| null>`                       | The latest submitted transaction outcome.              |
| `reset`       | `() => void`                                                  | Clears state and invalidates any in-flight completion. |

## Examples

### Example 1 - strict send

Send exactly 10 XLM and require at least 2.4 USDC.

```vue
<script setup lang="ts">
import { usePathPayment } from "@use-stellar/vue"

const { pathPayment, loading } = usePathPayment()
const usdc = {
  code: "USDC",
  issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
}

async function sendExactXlm(): Promise<void> {
  await pathPayment({
    mode: "strictSend",
    destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
    sendAsset: "XLM",
    sendAmount: "10.0000000",
    destAsset: usdc,
    destMin: "2.4000000",
    path: [],
  })
}
</script>

<template>
  <button type="button" :disabled="loading" @click="sendExactXlm">Swap 10 XLM</button>
</template>
```

### Example 2 - strict receive

Receive exactly 5 USDC while spending no more than 21 XLM.

```vue
<script setup lang="ts">
import { usePathPayment } from "@use-stellar/vue"

const { pathPayment, result } = usePathPayment()

async function receiveExactUsdc(): Promise<void> {
  await pathPayment({
    mode: "strictReceive",
    destination: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
    sendAsset: "XLM",
    sendMax: "21.0000000",
    destAsset: {
      code: "USDC",
      issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
    },
    destAmount: "5.0000000",
    path: [],
  })
}
</script>

<template>
  <button type="button" @click="receiveExactUsdc">Receive 5 USDC</button>
  <output v-if="result">{{ result.hash }}</output>
</template>
```

### Example 3 - handling a moved rate

```vue
<script setup lang="ts">
import { computed } from "vue"
import { usePathPayment } from "@use-stellar/vue"

const { error, reset } = usePathPayment()
const rateMoved = computed(() => error.value?.message.includes("rate moved") ?? false)

function requestNewQuote(): void {
  reset()
  window.dispatchEvent(new CustomEvent("refresh-payment-paths"))
}
</script>

<template>
  <div v-if="rateMoved">
    <p>The rate moved. Nothing was sent.</p>
    <button type="button" @click="requestNewQuote">Get a new quote</button>
  </div>
</template>
```

## TypeScript

```ts
type PathPaymentOptions =
  | {
      mode: "strictSend"
      destination: string
      sendAsset: Asset
      sendAmount: string
      destAsset: Asset
      destMin: string
      path?: Asset[]
      memo?: string
    }
  | {
      mode: "strictReceive"
      destination: string
      sendAsset: Asset
      sendMax: string
      destAsset: Asset
      destAmount: string
      path?: Asset[]
      memo?: string
    }

interface UsePathPaymentReturn {
  pathPayment: (options: PathPaymentOptions) => Promise<TransactionResult>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}
```

The union rejects `destMin` in strict-receive mode and `sendMax` in strict-send mode.

## Common errors

| Error code or message  | Cause                                                                          | Fix                                                    |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `WALLET_NOT_CONNECTED` | No wallet is connected to the Vue runtime.                                     | Connect a supported wallet before invoking the action. |
| `WRONG_NETWORK`        | The wallet and runtime networks differ.                                        | Switch the wallet to testnet.                          |
| `VALIDATION_ERROR`     | A required mode-specific amount or bound is missing, or an asset is malformed. | Use the matching union branch and a complete asset.    |
| `op_under_dest_min`    | Strict-send execution would return less than `destMin`.                        | Fetch a fresh path and recompute the bound.            |
| `op_over_source_max`   | Strict-receive execution would spend more than `sendMax`.                      | Fetch a fresh path and recompute the bound.            |

## Notes

- A slippage failure is atomic. No partial conversion occurs.
- Use a fresh quote to calculate `destMin` or `sendMax`; never use an unbounded value.
- A successful submission invalidates the connected account's cached balances.
- Disposing the owning scope or calling `reset()` prevents an older completion from changing state.

## Differences from React

Vue returns refs instead of plain render values. The discriminated options, transaction construction, wallet signing, fee policy, and cache invalidation come from the same React-free core action.

## Related hooks

- [React `usePathPayment`](../hooks/use-path-payment.md) - the equivalent React API.
- [`useBalance`](./use-balance.md) - reads the sender's refreshed balances.
