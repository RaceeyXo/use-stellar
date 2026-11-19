# useAddTrustline

Adds or updates a testnet trustline for an issued Stellar asset.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useAddTrustline } from "@use-stellar/vue"
```

## Basic usage

Call the action after the app has connected a wallet through the installed runtime.

```vue
<script setup lang="ts">
import { useAddTrustline } from "@use-stellar/vue"

const { addTrustline, loading, error, result } = useAddTrustline()

async function addUsdc(): Promise<void> {
  await addTrustline({
    asset: {
      code: "USDC",
      issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
    },
  })
}
</script>

<template>
  <button type="button" :disabled="loading" @click="addUsdc">Add USDC trustline</button>
  <p v-if="error">{{ error.message }}</p>
  <p v-if="result">Transaction: {{ result.hash }}</p>
</template>
```

## Parameters

The composable takes no parameters. `addTrustline(options)` accepts:

| Parameter       | Type          | Required | Default         | Description                                                                 |
| --------------- | ------------- | -------- | --------------- | --------------------------------------------------------------------------- |
| `asset`         | `IssuedAsset` | Yes      | -               | The asset code and issuer. XLM cannot have a trustline.                     |
| `limit`         | `string`      | No       | Network maximum | The maximum amount this account may hold. `"0"` removes an empty trustline. |
| `fee`           | `string`      | No       | Dynamic bid     | An exact positive fee in stroops.                                           |
| `feeMultiplier` | `number`      | No       | `10`            | Multiplies Horizon's current base fee.                                      |

## Return values

| Property       | Type                                                           | Description                                            |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `addTrustline` | `(options: AddTrustlineOptions) => Promise<TransactionResult>` | Builds, signs, and submits `changeTrust`.              |
| `loading`      | `Ref<boolean>`                                                 | `true` only while the latest request is running.       |
| `error`        | `ShallowRef<StellarError \| null>`                             | The latest transaction failure.                        |
| `result`       | `ShallowRef<TransactionResult \| null>`                        | The latest successful, failed, or pending outcome.     |
| `reset`        | `() => void`                                                   | Clears state and invalidates any in-flight completion. |

## Examples

### Example 1 - the common case

Create a testnet USDC trustline.

```vue
<script setup lang="ts">
import { useAddTrustline } from "@use-stellar/vue"

const { addTrustline, loading } = useAddTrustline()
const asset = {
  code: "USDC",
  issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
}
</script>

<template>
  <button type="button" :disabled="loading" @click="addTrustline({ asset })">Trust USDC</button>
</template>
```

### Example 2 - with a holding limit

Pass the decimal string exactly as it should be encoded in the operation.

```vue
<script setup lang="ts">
import { useAddTrustline } from "@use-stellar/vue"

const { addTrustline, result } = useAddTrustline()

async function trustLimitedUsdc(): Promise<void> {
  await addTrustline({
    asset: {
      code: "USDC",
      issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
    },
    limit: "1000.0000000",
  })
}
</script>

<template>
  <button type="button" @click="trustLimitedUsdc">Trust up to 1000 USDC</button>
  <output v-if="result">{{ result.hash }}</output>
</template>
```

### Example 3 - handling errors and retrying

```vue
<script setup lang="ts">
import { useAddTrustline } from "@use-stellar/vue"

const { addTrustline, error, reset } = useAddTrustline()
const asset = {
  code: "USDC",
  issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
}

async function retry(): Promise<void> {
  reset()
  try {
    await addTrustline({ asset })
  } catch {
    // The reactive error ref is rendered below.
  }
}
</script>

<template>
  <div>
    <p v-if="error">{{ error.message }}</p>
    <button type="button" @click="retry">Try again</button>
  </div>
</template>
```

## TypeScript

```ts
interface AddTrustlineOptions extends FeeOptions {
  asset: IssuedAsset
  limit?: string
}

interface UseAddTrustlineReturn {
  addTrustline: (options: AddTrustlineOptions) => Promise<TransactionResult>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<TransactionResult | null>
  reset: () => void
}
```

## Common errors

| Error code             | Cause                                                    | Fix                                                      |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `WALLET_NOT_CONNECTED` | No wallet is connected to the Vue runtime.               | Connect a supported wallet before invoking the action.   |
| `WRONG_NETWORK`        | The wallet and runtime networks differ.                  | Switch the wallet to testnet.                            |
| `VALIDATION_ERROR`     | The asset is XLM, malformed, or the call ran during SSR. | Pass a complete issued asset and call from client setup. |
| `TX_TIMEOUT`           | Horizon timed out after submission.                      | Inspect `result.hash`; do not immediately resubmit.      |

## Notes

- The exact runtime network passphrase is passed to the wallet signer.
- A successful submission invalidates the connected account's cached balances.
- Disposing the owning scope or calling `reset()` prevents an older completion from changing state.

## Differences from React

Vue returns refs instead of plain render values. The transaction behavior, validation, fee policy, wallet signing, and cache invalidation come from the same React-free core action.

## Related hooks

- [React `useAddTrustline`](../hooks/use-add-trustline.md) - the equivalent React API.
- [`useBalance`](./use-balance.md) - confirms the new balance line after invalidation.
