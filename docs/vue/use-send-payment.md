# useSendPayment

Sends a Stellar payment from the connected wallet and tracks the request in component-scoped state.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useSendPayment } from "@use-stellar/vue"
```

## Basic usage

This sends 10 testnet XLM. A wallet must be connected to the runtime.

```vue
<script setup lang="ts">
import { useSendPayment } from "@use-stellar/vue"

const { send, loading, error, result } = useSendPayment()

function pay() {
  return send({
    to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    asset: "XLM",
    amount: "10",
  })
}
</script>

<template>
  <button type="button" :disabled="loading" @click="pay">
    {{ loading ? "Sending..." : "Send 10 XLM" }}
  </button>
  <p v-if="error">{{ error.message }}</p>
  <p v-else-if="result">Status: {{ result.status }}</p>
</template>
```

## Parameters

The composable takes no parameters. `send(options)` accepts:

| Parameter       | Type        | Required | Default     | Description                                                                |
| --------------- | ----------- | -------- | ----------- | -------------------------------------------------------------------------- |
| `to`            | `string`    | Yes      | -           | The destination address.                                                   |
| `asset`         | `Asset`     | Yes      | -           | `"XLM"`, or an issued `{ code, issuer }`.                                  |
| `amount`        | `string`    | Yes      | -           | The amount to send, as a decimal string.                                   |
| `memo`          | `MemoInput` | No       | none        | A text string, or `{ type: "text" \| "id" \| "hash" \| "return", value }`. |
| `fee`           | `string`    | No       | Dynamic bid | An exact fee in stroops, per operation. Wins over `feeMultiplier`.         |
| `feeMultiplier` | `number`    | No       | `10`        | Multiplies Horizon's current base fee.                                     |

## Return values

| Property  | Type                                                                               | Description                                            |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `send`    | `(options: SendPaymentOptions) => Promise<SendPaymentResult & { error?: string }>` | Builds, signs, and submits the payment.                |
| `loading` | `Ref<boolean>`                                                                     | `true` only while the latest request is running.       |
| `error`   | `ShallowRef<StellarError \| null>`                                                 | The latest failure.                                    |
| `result`  | `ShallowRef<SendPaymentResult \| null>`                                            | The latest outcome: `{ hash, status }`.                |
| `reset`   | `() => void`                                                                       | Clears state and invalidates any in-flight completion. |

`status` is one of `"pending"`, `"success"`, `"failed"` or `"not_found"`.

## Examples

### Example 1 - the common case

```vue
<script setup lang="ts">
import { useSendPayment } from "@use-stellar/vue"

const { send, loading } = useSendPayment()
</script>

<template>
  <button
    type="button"
    :disabled="loading"
    @click="
      send({
        to: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
        asset: 'XLM',
        amount: '1',
      })
    "
  >
    Send 1 XLM
  </button>
</template>
```

### Example 2 - an issued asset with a memo

This uses the testnet USDC issuer. Confirm the issuer for the network you are on before reusing it.

```vue
<script setup lang="ts">
import { useSendPayment } from "@use-stellar/vue"

const { send, loading } = useSendPayment()

function pay() {
  return send({
    to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    asset: {
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
    amount: "50",
    memo: "Invoice 1042",
  })
}
</script>

<template>
  <button type="button" :disabled="loading" @click="pay">Send 50 USDC</button>
</template>
```

### Example 3 - handling errors and retrying

`send` rejects on failure, so wrap it when you need to react to the error.

```vue
<script setup lang="ts">
import { useSendPayment } from "@use-stellar/vue"

const { send, loading, error, result, reset } = useSendPayment()

async function pay() {
  try {
    await send({
      to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      asset: "XLM",
      amount: "10",
    })
  } catch {
    // `error` already holds the failure.
  }
}
</script>

<template>
  <button type="button" :disabled="loading" @click="pay">Send</button>
  <div v-if="error">
    <p>{{ error.message }}</p>
    <button type="button" @click="reset">Dismiss</button>
  </div>
  <p v-else-if="result">{{ result.hash }} - {{ result.status }}</p>
</template>
```

## TypeScript

```ts
interface SendPaymentOptions extends FeeOptions {
  to: string
  asset: Asset
  amount: string
  memo?: MemoInput
}

interface SendPaymentResult {
  hash: string
  status: TransactionStatus
}

interface UseSendPaymentReturn {
  send: (options: SendPaymentOptions) => Promise<SendPaymentResult & { error?: string }>
  loading: Ref<boolean>
  error: ShallowRef<StellarError | null>
  result: ShallowRef<SendPaymentResult | null>
  reset: () => void
}
```

## Common errors

| Error code             | Cause                                                 | Fix                                                                       |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `WALLET_NOT_CONNECTED` | No wallet is connected to the Vue runtime.            | Connect a supported wallet before calling `send`.                         |
| `WRONG_NETWORK`        | The wallet and the runtime are on different networks. | Switch the wallet to the runtime's network.                               |
| `VALIDATION_ERROR`     | The call ran during server rendering.                 | Call `send` from client code, such as an event handler.                   |
| `NETWORK_ERROR`        | The device is offline, or Horizon is unreachable.     | Reconnect and try again. Nothing was signed while offline.                |
| `TX_TIMEOUT`           | Horizon timed out after submission.                   | Inspect `result.hash`. Do not resubmit straight away: it may have landed. |

## Notes

- While the device is offline, `send` throws before anything is built or signed. A payment is never queued for later.
- A preflight failure (for example no wallet) rejects without replacing the `error` and `result` from an earlier attempt.
- A user who cancels signing resolves with `{ hash: "", status: "failed", error }` instead of rejecting.
- On `TX_TIMEOUT`, `result` is set to `{ hash, status: "pending" }` so the hash is not lost.
- A completion that arrives after the component's scope is disposed, or after `reset()`, is ignored.
- `send` reads the wallet from the runtime at call time, so it signs with whichever wallet is connected then.

## Differences from React

State is exposed as refs (`loading`, `error`, `result`), so read them with `.value` in scripts. Templates unwrap them.

## Related hooks

- [React `useSendPayment`](../hooks/use-send-payment.md) - the equivalent React API.
- [`usePayments`](./use-payments.md) - lists payments, including the one just sent.
- [`usePathPayment`](./use-path-payment.md) - pays in one asset while the recipient receives another.
