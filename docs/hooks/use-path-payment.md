# usePathPayment

Sends a path payment — Stellar's built-in swap — converting one asset into another as part of a single transaction.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { usePathPayment } from "use-stellar"
```

## What a path payment is

You send USDC, the recipient receives EURC, and the network routes the conversion through the order book and liquidity pools atomically: either the whole conversion happens at an acceptable rate, or nothing happens at all. No smart contract, no separate DEX integration, one operation.

There are two modes, and the difference is which side is pinned:

| Mode | You pin | You bound | Operation |
| :--- | :--- | :--- | :--- |
| `strictSend` | `sendAmount` — exactly what leaves your account | `destMin` — the least the recipient will accept | `pathPaymentStrictSend` |
| `strictReceive` | `destAmount` — exactly what arrives | `sendMax` — the most you will spend | `pathPaymentStrictReceive` |

## Slippage: read this before you ship

The bound is not optional and it is not a formality. It is the only thing standing between your user and a conversion at a rate they never agreed to.

Rates move between the moment you fetch a quote and the moment the transaction executes. Without a bound, the network is free to fill at whatever the book offers by then.

- `destMin: "0"` authorises the network to give the recipient **nothing**.
- An unbounded `sendMax` authorises the network to spend **everything you have**.

So `destMin` and `sendMax` are **required**. The `mode` field makes the wrong shape a TypeScript error, and a `VALIDATION_ERROR` at runtime for JavaScript callers. There is no permissive default anywhere in this hook.

### A worked example, with the arithmetic shown

You want to send exactly 100 XLM and have the recipient receive USDC. You accept up to **1% slippage**.

**Step 1 — quote.** Ask `usePaymentPaths` what 100 XLM currently buys.

```ts
// paths[0].destinationAmount === "25.0000000"
```

**Step 2 — compute the bound.** 1% below the quote:

```
25.0000000 × (1 − 0.01) = 24.7500000
```

Do it in stroops (a stroop is 1/10,000,000 of a unit) so no float rounding creeps in:

```
25.0000000 USDC        = 250000000 stroops
1% tolerance           = 100 basis points
250000000 × (10000 − 100) / 10000 = 247500000 stroops
247500000 stroops      = 24.7500000 USDC
```

**Step 3 — submit with `destMin: "24.7500000"`.** If the rate moves such that the recipient would get less than 24.75 USDC, the transaction fails and nothing moves. That is the protection working.

```tsx
/** Reduces an amount by a tolerance, in stroops, with no float arithmetic. */
function applySlippage(amount: string, toleranceBasisPoints: bigint): string {
  const [whole, fraction = ""] = amount.split(".")
  const stroops = BigInt(whole + fraction.padEnd(7, "0").slice(0, 7))
  const bounded = (stroops * (10000n - toleranceBasisPoints)) / 10000n

  const text = bounded.toString().padStart(8, "0")
  return `${text.slice(0, -7)}.${text.slice(-7)}`
}

applySlippage("25.0000000", 100n) // "24.7500000"
```

For `strictReceive`, move the bound the other way — `sendMax` is the quote **plus** your tolerance:

```
20.0000000 XLM × (10000 + 100) / 10000 = 20.2000000 XLM
```

> **A quote goes stale in seconds.** Fetch the path, compute the bound, and submit immediately. A quote that has been sitting on screen while a user reads is not a quote any more — call `refetch()` before you build the transaction.

## Basic usage

```tsx
import { usePathPayment } from "use-stellar"

const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
}

function SwapButton({ destination }: { destination: string }) {
  const { pathPayment, loading, error, result } = usePathPayment()

  async function handleSwap() {
    await pathPayment({
      mode: "strictSend",
      destination,
      sendAsset: "XLM",
      sendAmount: "100",
      destAsset: USDC,
      destMin: "24.7500000",
      path: [],
    })
  }

  if (error) return <p>Error: {error.message}</p>
  if (result) return <p>Sent: {result.hash}</p>

  return (
    <button onClick={handleSwap} disabled={loading}>
      {loading ? "Swapping..." : "Swap 100 XLM for USDC"}
    </button>
  )
}
```

## Parameters

`pathPayment(options)` takes one object. Which fields are required depends on `mode`.

**`mode: "strictSend"`**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `destination` | `string` | Yes | The recipient's Stellar address. |
| `sendAsset` | `Asset` | Yes | The asset leaving your account. |
| `sendAmount` | `string` | Yes | Exactly what leaves your account. |
| `destAsset` | `Asset` | Yes | The asset the recipient receives. |
| `destMin` | `string` | **Yes** | The least the recipient will accept. Your slippage bound. |
| `path` | `Asset[]` | No | Intermediate hops from `usePaymentPaths`. Empty means direct. |
| `memo` | `string` | No | An optional text memo. |

**`mode: "strictReceive"`**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `destination` | `string` | Yes | The recipient's Stellar address. |
| `sendAsset` | `Asset` | Yes | The asset leaving your account. |
| `sendMax` | `string` | **Yes** | The most you will spend. Your slippage bound. |
| `destAsset` | `Asset` | Yes | The asset the recipient receives. |
| `destAmount` | `string` | Yes | Exactly what arrives. |
| `path` | `Asset[]` | No | Intermediate hops from `usePaymentPaths`. Empty means direct. |
| `memo` | `string` | No | An optional text memo. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `pathPayment` | `(options) => Promise<TransactionResult>` | Builds, signs, and submits the swap. |
| `loading` | `boolean` | `true` while the transaction is in flight. |
| `error` | `StellarError \| null` | The failure, or `null`. |
| `result` | `TransactionResult \| null` | The outcome of the last successful submission. |
| `reset` | `() => void` | Clears `error` and `result`. |

## An empty path means direct

`path: []` is a valid, meaningful value: convert directly, with no intermediate hop. It is not a missing value and the hook does not reject it.

Take the path from `usePaymentPaths` and pass `paths[0].path` through unchanged, empty or not.

## Assets are never substituted

If an asset is not `"XLM"` and not a complete `{ code, issuer }` pair, the call fails with a `VALIDATION_ERROR`. It never silently falls back to XLM.

Sending the wrong asset is bad. Sending the wrong asset in a swap — where it is also being converted — is worse.

## Examples

### Example 1 — quote, bound, and submit

```tsx
import { usePaymentPaths, usePathPayment } from "use-stellar"

const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
}

function applySlippage(amount: string, toleranceBasisPoints: bigint): string {
  const [whole, fraction = ""] = amount.split(".")
  const stroops = BigInt(whole + fraction.padEnd(7, "0").slice(0, 7))
  const bounded = (stroops * (10000n - toleranceBasisPoints)) / 10000n

  const text = bounded.toString().padStart(8, "0")
  return `${text.slice(0, -7)}.${text.slice(-7)}`
}

function Swap({ destination }: { destination: string }) {
  const { paths, refetch } = usePaymentPaths({
    mode: "strictSend",
    sourceAsset: "XLM",
    sourceAmount: "100",
    destinationAsset: USDC,
  })

  const { pathPayment, loading, error } = usePathPayment()

  async function handleSwap() {
    // Re-quote immediately before signing.
    await refetch()

    const best = paths[0]
    if (!best) return

    await pathPayment({
      mode: "strictSend",
      destination,
      sendAsset: "XLM",
      sendAmount: "100",
      destAsset: USDC,
      destMin: applySlippage(best.destinationAmount, 100n), // 1%
      path: best.path,
    })
  }

  return (
    <div>
      <p>You receive about {paths[0]?.destinationAmount ?? "—"} USDC</p>
      <button onClick={handleSwap} disabled={loading || !paths[0]}>
        Swap
      </button>
      {error && <p>{error.message}</p>}
    </div>
  )
}
```

### Example 2 — strict receive, paying an exact invoice

```tsx
import { usePathPayment } from "use-stellar"

const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
}

function PayInvoice({ destination }: { destination: string }) {
  const { pathPayment, loading } = usePathPayment()

  async function pay() {
    await pathPayment({
      mode: "strictReceive",
      destination,
      sendAsset: "XLM",
      // Quoted at 20 XLM; 1% tolerance upward.
      sendMax: "20.2000000",
      destAsset: USDC,
      destAmount: "5.0000000",
      path: [],
    })
  }

  return (
    <button onClick={pay} disabled={loading}>
      Pay 5 USDC with XLM
    </button>
  )
}
```

### Example 3 — telling the user the rate moved

```tsx
import { usePathPayment } from "use-stellar"

function SwapWithRetry({ onRequote }: { onRequote: () => void }) {
  const { pathPayment, error, reset } = usePathPayment()

  if (error?.message.includes("rate moved")) {
    return (
      <div>
        <p>The rate moved while you were confirming. Nothing was sent.</p>
        <button
          onClick={() => {
            reset()
            onRequote()
          }}
        >
          Get a new quote
        </button>
      </div>
    )
  }

  return <button onClick={() => pathPayment(/* ... */)}>Swap</button>
}
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
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `"The rate moved past your slippage bound (op_under_dest_min)."` | The book moved; the recipient would have received less than `destMin`. Nothing was sent. | Re-fetch the path, recompute `destMin`, submit again. |
| `"The rate moved past your slippage bound (op_over_source_max)."` | The book moved; the swap would have cost more than `sendMax`. Nothing was sent. | Re-fetch the path, recompute `sendMax`, submit again. |
| `'usePathPayment: "strictSend" requires `destMin` ...'` | The slippage bound was omitted. | Pass a bound derived from a fresh quote. |
| `"Wallet not connected. Call connect() first."` | No wallet is connected. | Call `connect()` from `useWallet`. |
| `"Network mismatch: Provider is on testnet but wallet is on mainnet."` | The wallet is on a different network. | Switch networks in the wallet, or call `refreshWalletNetwork()`. |
| `"The destination account does not trust the asset ..."` | The recipient has no trustline for `destAsset`. | The recipient must add a trustline first. |

## Notes

- `status` is derived from what Horizon reported (`successful`), not assumed from the absence of an error.
- The same wallet, browser, and network guards as [`useSendPayment`](./use-send-payment.md) apply before anything is built.
- A slippage failure means **nothing moved**. The transaction failed as a whole; no partial conversion happens.

## Related hooks

- [`usePaymentPaths`](./use-payment-paths.md) — fetch the route and the quote this hook needs.
- [`useSendPayment`](./use-send-payment.md) — send an asset without converting it.
