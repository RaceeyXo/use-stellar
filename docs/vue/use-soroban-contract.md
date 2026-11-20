# useSorobanContract

Simulates a read-only Soroban contract call and returns the decoded result, through the shared Vue cache.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useSorobanContract } from "@use-stellar/vue"
```

## Basic usage

Replace `CONTRACT_ID` with a contract deployed on testnet.

```vue
<script setup lang="ts">
import { useSorobanContract } from "@use-stellar/vue"

const { data, loading, error } = useSorobanContract<string>({
  contractId: "CONTRACT_ID",
  method: "name",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">{{ error.message }}</p>
  <p v-else>{{ data }}</p>
</template>
```

## Parameters

| Parameter       | Type                                                        | Required | Default                       | Description                                                                        |
| --------------- | ----------------------------------------------------------- | -------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| `contractId`    | `MaybeRefOrGetter<string \| null \| undefined>`             | Yes      | -                             | The contract to call. Empty values keep the composable idle.                       |
| `method`        | `MaybeRefOrGetter<string \| null \| undefined>`             | Yes      | -                             | The contract function to call. Empty values keep the composable idle.              |
| `args`          | `MaybeRefOrGetter<readonly unknown[] \| null \| undefined>` | No       | `[]`                          | Call arguments. `xdr.ScVal` values pass through untouched.                         |
| `spec`          | `MaybeRefOrGetter<ContractSpecLike \| null \| undefined>`   | No       | none                          | The parsed contract spec. Converts arguments and decodes the return value by type. |
| `sourceAccount` | `MaybeRefOrGetter<string \| null \| undefined>`             | No       | `ANONYMOUS_SIMULATION_SOURCE` | The account to simulate as.                                                        |
| `staleTime`     | `number`                                                    | No       | Plugin setting                | Milliseconds before a cached result becomes stale. Static, not reactive.           |

## Return values

| Property  | Type                                | Description                                         |
| --------- | ----------------------------------- | --------------------------------------------------- |
| `data`    | `ComputedRef<T \| null>`            | The decoded result, or `null` before the first one. |
| `loading` | `ComputedRef<boolean>`              | `true` while the simulation is running.             |
| `error`   | `ComputedRef<StellarError \| null>` | The failure, or `null`.                             |
| `refetch` | `() => void`                        | Forces a fresh simulation.                          |

`T` is the type parameter: `useSorobanContract<T>()`. It defaults to `unknown`.

## Examples

### Example 1 - the common case

```vue
<script setup lang="ts">
import { useSorobanContract } from "@use-stellar/vue"

const { data } = useSorobanContract({ contractId: "CONTRACT_ID", method: "symbol" })
</script>

<template>
  <output>{{ data }}</output>
</template>
```

### Example 2 - reactive arguments

Arguments and the method can be refs or getters. The call re-runs when they change.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { Address } from "@stellar/stellar-sdk"
import { useSorobanContract } from "@use-stellar/vue"

const owner = ref("GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS")
const { data, loading } = useSorobanContract<bigint>({
  contractId: "CONTRACT_ID",
  method: "balance",
  args: () => [new Address(owner.value).toScVal()],
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <output v-else>{{ data }}</output>
</template>
```

### Example 3 - handling errors and retrying

```vue
<script setup lang="ts">
import { useSorobanContract } from "@use-stellar/vue"

const { data, error, refetch } = useSorobanContract({
  contractId: "CONTRACT_ID",
  method: "name",
})
</script>

<template>
  <div v-if="error">
    <p>{{ error.code }}: {{ error.message }}</p>
    <button type="button" @click="refetch">Try again</button>
  </div>
  <output v-else>{{ data }}</output>
</template>
```

## TypeScript

```ts
interface UseSorobanContractOptions {
  contractId: MaybeRefOrGetter<string | null | undefined>
  method: MaybeRefOrGetter<string | null | undefined>
  args?: MaybeRefOrGetter<readonly unknown[] | null | undefined>
  spec?: MaybeRefOrGetter<ContractSpecLike | null | undefined>
  sourceAccount?: MaybeRefOrGetter<string | null | undefined>
  staleTime?: number
}

interface UseSorobanContractReturn<T = unknown> {
  data: ComputedRef<T | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => void
}
```

## Common errors

| Error code          | Cause                                                                            | Fix                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SIMULATION_FAILED` | The RPC rejected the simulation, or returned no result.                          | Check the contract ID, method name, and argument types.                                                                           |
| Argument error      | An argument is a bare `number`, `string` or `bigint`, which Soroban cannot type. | Pass `xdr.ScVal` values, for example `nativeToScVal(7, { type: "u32" })`, or supply a `spec`. `error.message` names the argument. |
| `NETWORK_ERROR`     | The Soroban RPC is unreachable.                                                  | Check the configured RPC URL, then `refetch()`.                                                                                   |

## Notes

- The composable is idle until both `contractId` and `method` are non-empty after trimming.
- The cache key follows the canonical serialized arguments, not Vue proxy identity, so rebuilding an equal array does not refetch.
- With no `sourceAccount`, the simulation runs as `ANONYMOUS_SIMULATION_SOURCE`, which this package also exports. Pass the connected wallet address to simulate as the user.
- It only simulates. It never signs or submits a transaction.

## Differences from React

Vue accepts refs and getters for the call itself, and returns computed refs. `staleTime` is the one static option.

## Related hooks

- [React `useSorobanContract`](../hooks/use-soroban-contract.md) - the equivalent React API.
- [`useContractEvents`](./use-contract-events.md) - watches the events a contract emits.
