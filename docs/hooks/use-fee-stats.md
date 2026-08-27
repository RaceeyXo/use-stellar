# useFeeStats

Fetches Horizon fee statistics for the active network so you can bid an inclusion fee that will actually land.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useFeeStats } from "use-stellar"
```

## Basic usage

```tsx
import { useFeeStats } from "use-stellar"

function FeeBanner() {
  const { baseFee, isSurging, suggested, loading, error } = useFeeStats()

  if (loading) return <p>Loading fee stats...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <p>Network base fee: {baseFee} stroops</p>
      {isSurging ? <p>The network is busy. Fees are elevated.</p> : <p>Fees are at the network minimum.</p>}
      <p>Suggested max bid: {suggested()} stroops</p>
    </div>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `watch` | `boolean` | No | `false` | When true, re-fetches fee stats on an interval. |
| `interval` | `number` | No | `10000` | Polling interval in milliseconds when `watch` is true. Values that are not finite, `<= 0`, or larger than `2^31 - 1` fall back to `10000`. |

## Return values

| Property | Type | Description |
| --- | --- | --- |
| `baseFee` | `string` | `last_ledger_base_fee` from Horizon, in stroops. Empty string until the first successful fetch. |
| `percentiles` | `Record<"p10" \| "p50" \| "p90" \| "p95" \| "p99", string>` | Charged-fee percentiles over the last 5 ledgers, in stroops. |
| `isSurging` | `boolean` | `true` when `fee_charged.mode` is strictly greater than `last_ledger_base_fee`. |
| `suggested` | `(urgency?: FeeUrgency) => string` | Returns a max fee bid in stroops. See [suggested()](#suggested). |
| `loading` | `boolean` | `true` while a request is in flight. |
| `error` | `StellarError \| null` | Set when the Horizon request or payload validation fails. |
| `lastUpdated` | `Date \| null` | Timestamp of the last successful fetch. |
| `refetch` | `() => Promise<void>` | Re-runs the Horizon request immediately. |

### isSurging

The flag compares the **most common charged fee** (`fee_charged.mode`) to the **protocol floor for the last ledger** (`last_ledger_base_fee`). Horizon no longer ships a `min_accepted_fee` field; `last_ledger_base_fee` is that floor.

The threshold is a **1-stroop gap**. If the two values are equal, most transactions still land at the minimum and `isSurging` is `false`. If mode is even one stroop above the floor, the most common inclusion fee beat the minimum and `isSurging` is `true`.

This does not look at `ledger_capacity_usage` or at `max_fee` (what people *offered*). A long tail of overbids does not by itself mean the typical transaction is competing.

### suggested()

| urgency | charged percentile | default |
| --- | --- | --- |
| `"low"` | `p50` | no |
| `"normal"` | `p90` | yes (`suggested()` with no argument) |
| `"high"` | `p99` | no |

The value is taken from **`fee_charged`**, not `max_fee`. Charged percentiles are what actually got included. `max_fee` is the bid distribution and is often far above inclusion cost.

The result is floored at `last_ledger_base_fee`. It is always a stroop **string**. Fees are int64; do not run them through `Number` or `parseFloat`.

**A fee is a maximum bid, not a charge.** Stellar only takes what the ledger needs to include the transaction. On a quiet ledger a `suggested("high")` bid still costs the network minimum. That is why a high bid is safe to use as a default when you care about landing.

Call `suggested()` only after `loading` is `false` and `error` is `null`. Before that it throws a `VALIDATION_ERROR`.

## Examples

### Example 1 — show a surge warning

```tsx
import { useFeeStats } from "use-stellar"

function SurgeWarning() {
  const { isSurging, loading, error } = useFeeStats({ watch: true, interval: 15000 })

  if (loading) return <p>Checking network fees...</p>
  if (error) return <p>{error.message}</p>
  if (!isSurging) return null

  return <p>Network is busy. Transactions that bid the minimum fee may be rejected.</p>
}
```

### Example 2 — pick a max bid before building a payment

```tsx
import { useFeeStats } from "use-stellar"
import { useSendPayment } from "use-stellar"

function PayButton() {
  const { suggested, loading, error } = useFeeStats()
  const { send } = useSendPayment()

  if (loading) return <p>Loading fees...</p>
  if (error) return <p>{error.message}</p>

  return (
    <button
      onClick={() =>
        send({
          to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
          asset: "XLM",
          amount: "1",
          fee: suggested("high"),
        })
      }
    >
      Send 1 XLM
    </button>
  )
}
```

The destination in this example is the same testnet account used in the `useSendPayment` docs. Pass `fee` as the stroop string from `suggested()`; do not convert it to a number.

### Example 3 — handling errors and retrying

```tsx
import { useFeeStats } from "use-stellar"

function FeeStatsWithRetry() {
  const { percentiles, error, refetch, loading } = useFeeStats()

  if (error) {
    return (
      <div>
        <p>Could not load fee stats: {error.message}</p>
        <button onClick={() => void refetch()} disabled={loading}>
          Try again
        </button>
      </div>
    )
  }

  if (loading) return <p>Loading...</p>

  return (
    <p>
      p50 {percentiles.p50} / p90 {percentiles.p90} / p99 {percentiles.p99} stroops
    </p>
  )
}
```

## TypeScript

```ts
type FeeUrgency = "low" | "normal" | "high"

interface UseFeeStatsOptions {
  watch?: boolean
  interval?: number
}

interface UseFeeStatsReturn {
  baseFee: string
  percentiles: Record<"p10" | "p50" | "p90" | "p95" | "p99", string>
  isSurging: boolean
  suggested: (urgency?: FeeUrgency) => string
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}
```

## Common errors

| Error message | Cause | Fix |
| --- | --- | --- |
| `"use-stellar: No StellarProvider found. Wrap your app in <StellarProvider> before using any use-stellar hooks."` | The hook ran outside `<StellarProvider>`. | Wrap the tree in `<StellarProvider network="testnet">`. |
| `"Unable to reach the Stellar network..."` / other `NETWORK_ERROR` | Horizon did not answer. | Check connectivity and `horizonUrl`, then call `refetch()`. |
| `"Fee stats have not loaded yet..."` | `suggested()` ran before the first successful fetch. | Wait until `loading` is `false` and `error` is `null`. |
| `"Horizon fee_stats field … is not a stroop integer string."` | Horizon returned a malformed fee field. | Retry. If it persists, the Horizon instance is not spec-compliant. |

## Notes

- Every fee value is a stroop string. Stroops are int64; JavaScript `number` cannot hold them safely.
- `watch` uses `setInterval` and clears it on unmount. In-flight responses that finish after unmount, or after a newer request has started, are ignored.
- This hook reports **Horizon inclusion fees** for classic transactions. Soroban transactions pay a resource fee derived from simulation (`useSorobanContract`). Those are a different mechanism and are not included here.
- `useSendPayment` currently bids `feeMultiplier × fetchBaseFee()`. Wiring `suggested("high")` into that path is a follow-up; you can pass `fee: suggested("high")` yourself today.

## Related hooks

- [`useSendPayment`](./use-send-payment.md) — builds a payment; pass `fee: suggested("high")` to bid from these stats.
- [`useNetwork`](./use-network.md) — the Horizon URL these stats are fetched from.
- [`useSorobanContract`](./use-soroban-contract.md) — Soroban resource fees, not Horizon `/fee_stats`.
