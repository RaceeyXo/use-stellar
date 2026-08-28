# usePaymentPaths

Finds the routes and quotes for converting one Stellar asset into another.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { usePaymentPaths } from "use-stellar"
```

## What a path is

Stellar can convert assets as part of a payment. You send USDC, the recipient receives EURC, and the network routes the conversion through the order book and liquidity pools.

A **path** is one candidate route: the chain of intermediate assets the conversion hops through — often empty, meaning a direct market exists — plus what leaves the sender and what arrives at the destination.

There are two questions you can ask, and they are not the same:

| Mode | You pin | You are asking |
| :--- | :--- | :--- |
| `strictSend` | `sourceAmount` | "I will send exactly 100 USDC. What can the recipient get?" |
| `strictReceive` | `destinationAmount` | "The recipient must get exactly 90 EURC. What will it cost me?" |

## Basic usage

```tsx
import { usePaymentPaths } from "use-stellar"

function SwapQuote() {
  const { paths, loading, error } = usePaymentPaths({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: {
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
  })

  if (loading) return <p>Finding a route...</p>
  if (error) return <p>Error: {error.message}</p>
  if (paths.length === 0) return <p>No route exists between these two assets.</p>

  const best = paths[0]

  return (
    <p>
      Send {best.sourceAmount} XLM, receive {best.destinationAmount} USDC (rate {best.rate})
    </p>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `mode` | `"strictSend" \| "strictReceive"` | Yes | — | Which side of the conversion is pinned. |
| `sourceAsset` | `Asset` | Yes | — | The asset leaving the sender. |
| `sourceAmount` | `string` | In `strictSend` | — | Exactly what leaves the sender. |
| `destinationAsset` | `Asset` | Yes | — | The asset arriving at the destination. |
| `destinationAmount` | `string` | In `strictReceive` | — | Exactly what must arrive. |
| `destinationAddress` | `string` | No | — | `strictSend` only. Restricts results to assets this account can actually receive. |
| `sourceAddress` | `string` | No | — | `strictReceive` only. Restricts results to assets this account actually holds. |
| `enabled` | `boolean` | No | `true` | When `false`, no request is issued. |
| `watch` | `boolean` | No | `false` | Re-fetch on an interval. |
| `interval` | `number` | No | `10000` | Polling interval in ms when `watch` is `true`. |

The mode decides which amount is required. Omitting it is a TypeScript error, and a `VALIDATION_ERROR` at runtime for JavaScript callers.

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `paths` | `PaymentPath[]` | Candidate routes, best rate first. Empty means no route exists. |
| `loading` | `boolean` | `true` while the request is in flight. |
| `error` | `StellarError \| null` | The failure, or `null`. |
| `lastUpdated` | `Date \| null` | When the current quote was fetched. |
| `refetch` | `() => Promise<void>` | Re-runs the query. |

Each `PaymentPath`:

| Property | Type | Description |
| :--- | :--- | :--- |
| `path` | `Asset[]` | Intermediate hops. Empty means a direct market. |
| `sourceAmount` | `string` | What leaves the sender on this route. |
| `destinationAmount` | `string` | What arrives on this route. |
| `rate` | `string` | `destinationAmount / sourceAmount`, as a precise decimal string. |

## Ordering

Paths are sorted **best rate first** — the most destination asset per unit of source asset. `paths[0]` is the route a UI should show by default, and the one to hand to `usePathPayment`.

## Rates are strings, and that is deliberate

`rate` is computed in `BigInt` on stroop integers, never with `parseFloat`. A float cannot represent every 7-decimal Stellar amount, and the rounding shows up as a wrong number in front of a user who is about to sign a transaction.

Do your own slippage arithmetic on strings or `BigInt` too.

## Quotes go stale in seconds

A quote is a snapshot of an order book that moves continuously. `lastUpdated` tells you when the numbers in `paths` were fetched.

> **Re-fetch immediately before you submit.** Do not quote on page load, let a user think for a minute, and then build a transaction from the stale numbers. Call `refetch()` — or use `watch` — and compute the slippage bound from the fresh quote.

## No route is not an error

If no route exists between the two assets, `paths` is `[]`, `error` is `null`, and `lastUpdated` is set. Horizon answered; the answer is "there is no way to do this".

Render that as information — "no route between these assets" — not as a failure.

## Examples

### Example 1 — quote → slippage bound → path payment

The full flow. This is what the hook is for.

```tsx
import { usePaymentPaths, usePathPayment } from "use-stellar"

const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
}

/** Reduces an amount by a tolerance, in stroops, with no float arithmetic. */
function applySlippage(amount: string, toleranceBasisPoints: bigint): string {
  const [whole, fraction = ""] = amount.split(".")
  const stroops = BigInt(whole + fraction.padEnd(7, "0").slice(0, 7))
  const bounded = (stroops * (10000n - toleranceBasisPoints)) / 10000n

  const text = bounded.toString().padStart(8, "0")
  return `${text.slice(0, -7)}.${text.slice(-7)}`
}

function Swap({ destination }: { destination: string }) {
  const { paths, lastUpdated, refetch } = usePaymentPaths({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: USDC,
  })

  const { pathPayment, loading } = usePathPayment()

  async function submit() {
    // Re-quote first. The rate on screen may be a minute old.
    await refetch()

    const best = paths[0]
    if (!best) return

    await pathPayment({
      mode: "strictSend",
      destination,
      sendAsset: "XLM",
      sendAmount: "100",
      destAsset: USDC,
      // 1% tolerance = 100 basis points.
      destMin: applySlippage(best.destinationAmount, 100n),
      path: best.path,
    })
  }

  if (!paths[0]) return <p>No route available.</p>

  return (
    <div>
      <p>
        You receive about {paths[0].destinationAmount} USDC
        {lastUpdated && ` (quoted ${lastUpdated.toLocaleTimeString()})`}
      </p>
      <button onClick={submit} disabled={loading}>
        Swap
      </button>
    </div>
  )
}
```

### Example 2 — strict receive, restricted to what the sender holds

```tsx
import { usePaymentPaths, useWallet } from "use-stellar"

function CostToSend() {
  const { address } = useWallet()

  const { paths } = usePaymentPaths({
    mode: "strictReceive",
    sourceAsset: "XLM",
    destinationAsset: {
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
    destinationAmount: "90",
    sourceAddress: address ?? undefined,
    enabled: Boolean(address),
  })

  if (!paths[0]) return <p>No route.</p>

  return <p>Sending 90 USDC costs {paths[0].sourceAmount} XLM.</p>
}
```

### Example 3 — keeping a quote fresh, and handling errors

```tsx
import { usePaymentPaths } from "use-stellar"

function LiveQuote() {
  const { paths, error, lastUpdated, refetch } = usePaymentPaths({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: {
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
    watch: true,
    interval: 5000,
  })

  if (error) {
    return (
      <div>
        <p>Could not fetch a quote: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return (
    <p>
      {paths[0]?.destinationAmount ?? "—"} USDC
      {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString()}`}
    </p>
  )
}
```

## TypeScript

```ts
interface PaymentPath {
  path: Asset[]
  sourceAmount: string
  destinationAmount: string
  rate: string
}

interface UsePaymentPathsReturn {
  paths: PaymentPath[]
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `'usePaymentPaths: "strictSend" mode requires `sourceAmount`.'` | `strictSend` with no amount to send. | Pass `sourceAmount`. |
| `'usePaymentPaths: "strictReceive" mode requires `destinationAmount`.'` | `strictReceive` with no amount to receive. | Pass `destinationAmount`. |
| `"Unsupported asset ..."` | An asset was neither `"XLM"` nor `{ code, issuer }`. | Correct the asset shape. |
| `"Account not found"` | The address passed to `destinationAddress` or `sourceAddress` is not funded. | Fund it on testnet with Friendbot, or omit the option. |

## Notes

- Assets are compared by their code and issuer, not by object identity. An inline `sourceAsset={{ code, issuer }}` prop does not produce a new `paths` array on every render, so it is safe to put `paths` in a dependency array.
- Responses that arrive out of order, or after the component unmounts, are discarded.
- `enabled: false` issues no request at all.

## Related hooks

- [`usePathPayment`](./use-path-payment.md) — executes the swap this hook quotes.
- [`useBalance`](./use-balance.md) — check what the sender actually holds.
