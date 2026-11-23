# useLiquidityPool

Reads an AMM liquidity pool through the shared Vue cache, and deposits into or withdraws from it with `useLiquidityPoolActions`.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useLiquidityPool, useLiquidityPoolActions } from "@use-stellar/vue"
```

## Basic usage

This component reads a testnet pool's reserves.

```vue
<script setup lang="ts">
import { useLiquidityPool } from "@use-stellar/vue"

const { pool, loading, error } = useLiquidityPool({
  poolId: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
})
</script>

<template>
  <p v-if="loading">Loading...</p>
  <p v-else-if="error">Could not load the pool ({{ error.code }}).</p>
  <ul v-else-if="pool">
    <li v-for="reserve in pool.reserves" :key="reserve.asset">
      {{ reserve.amount }} {{ reserve.asset }}
    </li>
  </ul>
</template>
```

## Parameters

| Parameter    | Type                                            | Required | Default        | Description                                                          |
| ------------ | ----------------------------------------------- | -------- | -------------- | -------------------------------------------------------------------- |
| `poolId`     | `MaybeRefOrGetter<string \| null \| undefined>` | Yes      | -              | A static pool id, Vue ref, or getter. Empty values keep it idle.     |
| `staleTime`  | `number`                                        | No       | Plugin setting | Milliseconds before cached pool data becomes stale.                  |
| `maxRetries` | `number`                                        | No       | `3`            | Retries after a rate limit (429), honouring `Retry-After`.           |

## Return values

| Property  | Type                                 | Description                                  |
| --------- | ------------------------------------ | -------------------------------------------- |
| `pool`    | `ComputedRef<LiquidityPool \| null>` | The pool, or `null` before it loads.         |
| `loading` | `ComputedRef<boolean>`               | `true` while the pool request is running.    |
| `error`   | `ComputedRef<StellarError \| null>`  | The request failure, or `null`.              |
| `refetch` | `() => Promise<void>`                | Forces a fresh pool request.                 |

## Deposits and withdrawals

`useLiquidityPoolActions()` signs with the connected wallet. Like the React hook, `deposit` and `withdraw` never throw: a failure resolves to `null` and is reported through `error`.

```vue
<script setup lang="ts">
import { useLiquidityPoolActions } from "@use-stellar/vue"

const poolId = "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7"
const { deposit, withdraw, loading, error, result } = useLiquidityPoolActions()

const add = () =>
  deposit({ poolId, maxAmountA: "10", maxAmountB: "25", minPrice: "0.35", maxPrice: "0.45" })
const remove = () => withdraw({ poolId, amount: "5", minAmountA: "1", minAmountB: "2" })
</script>

<template>
  <button type="button" :disabled="loading" @click="add">Deposit</button>
  <button type="button" :disabled="loading" @click="remove">Withdraw</button>
  <p v-if="error">{{ error.code }}: {{ error.message }}</p>
  <p v-else-if="result">{{ result.status }} — {{ result.hash }}</p>
</template>
```

| Property   | Type                                                                  | Description                                                   |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `deposit`  | `(options: LiquidityPoolDepositOptions) => Promise<TransactionResult \| null>`  | Deposits up to `maxAmountA`/`maxAmountB` within the price band. |
| `withdraw` | `(options: LiquidityPoolWithdrawOptions) => Promise<TransactionResult \| null>` | Redeems `amount` pool shares for at least the minimums.       |
| `loading`  | `Ref<boolean>`                                                        | `true` while the latest call is running.                      |
| `error`    | `ShallowRef<StellarError \| null>`                                    | The latest failure, or `null`.                                |
| `result`   | `ShallowRef<TransactionResult \| null>`                               | `{ hash, status: "success" }`, or `status: "failed"` with the hash when Horizon rejected the transaction. |
| `reset`    | `() => void`                                                          | Clears state and ignores any in-flight call.                  |

A successful call invalidates the signer's account and the pool in the shared store, so mounted `useBalance` and `useLiquidityPool` composables refetch.

## Common errors

| Code                   | Cause                                                     | Fix                                                |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `ACCOUNT_NOT_FOUND`    | No pool with this id on the network (Horizon 404).        | Check the id and the network.                      |
| `RATE_LIMITED`         | Horizon returned 429.                                     | Retried automatically up to `maxRetries`.          |
| `WALLET_NOT_CONNECTED` | `deposit`/`withdraw` called without a connected wallet.   | Connect a wallet first.                            |
| `VALIDATION_ERROR`     | `deposit`/`withdraw` called during server rendering.      | Call them from a client-side event handler.        |
| `NETWORK_ERROR`        | Offline, or Horizon is unreachable.                       | Reconnect and retry. Nothing was signed offline.   |

## Notes

- Same request, mapping and error codes as the React hook: both call `fetchLiquidityPool` and the `depositLiquidity`/`withdrawLiquidity` actions from `use-stellar/core`.
- Composables asking for the same pool share one request.
- Nothing is fetched during server rendering; the pool loads on the client.
- Testnet examples only.

## Differences from React

The React `useLiquidityPool(poolId)` takes the id as an argument; Vue takes `{ poolId }`, which may be a ref or getter. State is exposed as refs, so read it with `.value` in scripts.

## Related

- [`useBalance`](./use-balance.md) - refetches after a deposit or withdrawal.
- [`useAddTrustline`](./use-add-trustline.md) - a pool share trustline is needed before the first deposit.
