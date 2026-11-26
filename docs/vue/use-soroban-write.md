# useSorobanWrite

Invokes a state-changing Soroban contract method through the connected wallet: simulate, assemble, sign, send and poll.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useSorobanWrite } from "@use-stellar/vue"
```

## Basic usage

```vue
<script setup lang="ts">
import { nativeToScVal } from "@stellar/stellar-sdk"
import { useSorobanWrite } from "@use-stellar/vue"

const { invoke, loading, error, result } = useSorobanWrite<number>()

async function increment() {
  try {
    await invoke({
      contractId: "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR",
      method: "increment",
      args: [nativeToScVal(1, { type: "u32" })],
    })
  } catch {
    // The failure is also in `error`.
  }
}
</script>

<template>
  <button type="button" :disabled="loading" @click="increment">Increment</button>
  <p v-if="result?.status === 'success'">New value: {{ result.result }}</p>
  <p v-else-if="result?.status === 'pending'">Still waiting for {{ result.hash }}…</p>
  <p v-if="error">{{ error.code }}: {{ error.message }}</p>
</template>
```

## Options

| Option       | Type          | Required | Default   | Description                                                             |
| ------------ | ------------- | -------- | --------- | ----------------------------------------------------------------------- |
| `contractId` | `string`      | Yes      | -         | A C-prefixed contract id.                                               |
| `method`     | `string`      | Yes      | -         | The contract function to call.                                          |
| `args`       | `xdr.ScVal[]` | No       | `[]`      | Explicit XDR arguments.                                                 |
| `fee`        | `string`      | No       | `"100"`   | Inclusion fee in stroops; the resource fee comes from simulation.       |
| `timeout`    | `number`      | No       | `30000`   | Milliseconds to poll before giving up with `TX_TIMEOUT`.                |

## Return values

| Property | Type                                        | Description                                                                 |
| -------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `invoke` | `(options) => Promise<{ hash, result }>`    | Resolves like the React hook and throws the `StellarError` on failure.      |
| `loading`| `Ref<boolean>`                              | `true` while the latest call is running.                                    |
| `error`  | `ShallowRef<StellarError \| null>`          | The latest failure, or `null`.                                              |
| `result` | `ShallowRef<SorobanWriteState<T> \| null>`  | `{ hash, status, result }` for the latest call, see below.                  |
| `reset`  | `() => void`                                | Clears state and ignores any in-flight call.                                |

## State after each outcome

| Outcome                                          | `result`                                       | `error`              |
| ------------------------------------------------ | ---------------------------------------------- | -------------------- |
| Success                                          | `{ hash, status: "success", result }`          | `null`               |
| Rejected signature, guard or simulation failure  | `null`                                         | the `StellarError`   |
| Polling timed out                                | `{ hash, status: "pending", result: null }`    | `TX_TIMEOUT`         |
| Submission rejected or failed on-chain           | `{ hash, status: "failed", result: null }`     | `TRANSACTION_FAILED` |

`pending` means the outcome is unknown, not failed: the transaction may still land. Poll the hash to find out.

Each call gets an operation id. Only the latest call writes the refs, so a slow earlier call cannot overwrite a newer one, and nothing is written after the component unmounts. A successful call invalidates the signer's account queries in the shared store, so a mounted `useBalance` refetches.

## Common errors

| Code                        | Cause                                                         |
| --------------------------- | ------------------------------------------------------------- |
| `WALLET_NOT_CONNECTED`      | No connected wallet.                                          |
| `WRONG_NETWORK`             | The wallet is on a different network than the plugin.         |
| `VALIDATION_ERROR`          | Called during server rendering, or an invalid contract id.    |
| `NETWORK_ERROR`             | Offline. Nothing was signed.                                  |
| `SIMULATION_FAILED`         | The call fails in simulation.                                 |
| `RESTORE_PREAMBLE_REQUIRED` | Contract state is archived and must be restored first.        |
| `TRANSACTION_FAILED`        | Submission rejected, or the transaction failed on-chain.      |
| `TX_TIMEOUT`                | Polling gave up; the transaction may still succeed.           |

## Notes

- Same flow and error codes as the React hook: both call `invokeContract` from `use-stellar/core`.
- Testnet examples only.

## Differences from React

React's `result` is `{ hash, result }` and is only set on success. Vue's `result` also records `pending` and `failed` outcomes with their hash, so a template can show them without inspecting `error`.

## Related

- [`useSorobanContract`](../hooks/use-soroban-contract.md) - read-only contract calls.
