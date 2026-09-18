# useSendPayment

> Builds, signs, and submits a payment transaction on the Stellar network.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useSendPayment } from "use-stellar"
```

## Basic usage

This example runs as-is inside an app already wrapped in `StellarProvider`,
with a wallet already connected via `useWallet`.

```tsx
import { useSendPayment } from "use-stellar"

function SendButton() {
  const { send, loading, error, result } = useSendPayment()

  const handleSend = async () => {
    await send({
      to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      asset: "XLM",
      amount: "10",
    })
  }

  return (
    <div>
      <button onClick={handleSend} disabled={loading}>
        {loading ? "Sending..." : "Send 10 XLM"}
      </button>
      {error && <p>Error: {error.message}</p>}
      {result && <p>Sent. Hash: {result.hash}</p>}
    </div>
  )
}
```

## Why `amount` must be a string

Stellar amounts have exactly 7 decimal places of precision. JavaScript's
`number` type is a 64-bit float, which cannot represent every 7-decimal
value exactly. Passing a `number` risks silent rounding, and a rounding
error in a payment amount moves the wrong amount of money.

Always pass `amount` as a string, exactly as the user typed it or exactly
as you formatted it server-side. Do not run it through `Number()`,
`parseFloat()`, or arithmetic before passing it to `send()`.

```ts
// Wrong — a number can lose precision.
send({ to, asset: "XLM", amount: 10.1234567 })

// Right — the string is passed through unchanged.
send({ to, asset: "XLM", amount: "10.1234567" })
```

## Parameters

`useSendPayment` takes no parameters. Call the hook with no arguments, then
call the `send` function it returns with a `SendPaymentOptions` object.

### `SendPaymentOptions`

| Field    | Type     | Required | Description                                                                 |
| -------- | -------- | -------- | ----------------------------------------------------------------------------|
| `to`     | `string` | Yes      | The destination Stellar account address.                                    |
| `asset`  | `Asset`  | Yes      | The asset to send. Use the string `"XLM"` for the native asset, or `{ code, issuer }` for an issued asset. |
| `amount` | `string` | Yes      | The amount to send, as a string. See [Why amount must be a string](#why-amount-must-be-a-string). |
| `memo`   | `string` | No       | An optional text memo attached to the transaction.                          |
| `fee`    | `string` | No       | Explicit fee in stroops, per operation. Wins over `feeMultiplier`. See [Transaction fees](#transaction-fees). |
| `feeMultiplier` | `number` | No | Multiplies the network base fee fetched from Horizon. Defaults to `10`.  |

## Return values

| Property  | Type                                                          | Description                                                        |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `send`    | `(options: SendPaymentOptions) => Promise<SendPaymentResult>`  | Builds, signs, and submits the payment. Throws a `StellarError` on failure. |
| `loading` | `boolean`                                                       | `true` while a payment is being built, signed, or submitted.        |
| `error`   | `StellarError \| null`                                          | The error from the most recent `send()` call, or `null`.            |
| `result`  | `SendPaymentResult \| null`                                     | The result of the most recent successful `send()` call, or `null`.  |
| `reset`   | `() => void`                                                    | Clears `error` and `result`. See [Calling reset()](#calling-reset-before-a-new-send). |

## Examples

### Example 1 — send XLM

```tsx
import { useSendPayment } from "use-stellar"

function SendXlm() {
  const { send, loading } = useSendPayment()

  const handleClick = async () => {
    await send({
      to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      asset: "XLM",
      amount: "25",
    })
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? "Sending..." : "Send 25 XLM"}
    </button>
  )
}
```

### Example 2 — send USDC with a memo

This uses the testnet USDC issuer. Always confirm the issuer address for
the network you are testing against before reusing this snippet.

```tsx
import { useSendPayment } from "use-stellar"

function SendUsdcWithMemo() {
  const { send, loading } = useSendPayment()

  const handleClick = async () => {
    await send({
      to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
      amount: "50",
      memo: "Invoice 1042",
    })
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? "Sending..." : "Send 50 USDC"}
    </button>
  )
}
```

### Example 3 — a full form with state management

```tsx
import { useState } from "react"
import { useSendPayment } from "use-stellar"

function PaymentForm() {
  const { send, loading, error, result, reset } = useSendPayment()
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    reset()
    await send({ to, asset: "XLM", amount })
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Destination address
        <input value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label>
        Amount (XLM)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send"}
      </button>
      {error && <p>Error: {error.message}</p>}
      {result && <p>Sent. Hash: {result.hash}</p>}
    </form>
  )
}
```

### Example 4 — handling rejection

Freighter opens a popup asking the user to approve the transaction. If the
user closes the popup or clicks reject, `send()` throws a `StellarError`
with the code `WALLET_REQUEST_REJECTED`. This is a normal outcome, not a
bug, and your UI should treat it as such rather than showing a generic
crash message.

```tsx
import { useSendPayment } from "use-stellar"

function SendWithRejectionHandling() {
  const { send, loading, error, reset } = useSendPayment()

  const handleClick = async () => {
    reset()
    try {
      await send({
        to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
        asset: "XLM",
        amount: "5",
      })
    } catch {
      // error is also available via the hook's `error` return value.
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Sending..." : "Send 5 XLM"}
      </button>
      {error?.code === "WALLET_REQUEST_REJECTED" && (
        <p>You declined the transaction. No funds were sent.</p>
      )}
      {error && error.code !== "WALLET_REQUEST_REJECTED" && (
        <p>Error: {error.message}</p>
      )}
    </div>
  )
}
```

## Transaction fees

Stellar prices transactions by auction. Each ledger has limited capacity; when
more transactions are submitted than fit, the network takes the highest bidders
and rejects the rest with `tx_insufficient_fee`.

**A fee is a maximum bid, not a charge.** This is the part that is not obvious,
and it changes how you should think about the number. The network only ever
takes what it actually needs to include your transaction — bidding 10x the
minimum on a quiet ledger still costs the minimum. You are stating a ceiling,
not paying a price.

So the trade is lopsided. Bidding low saves nothing measurable and fails under
congestion; bidding high costs nothing measurable and survives it.

### The default

`useSendPayment` fetches the network's current base fee from Horizon and
multiplies it by **10** (`DEFAULT_FEE_MULTIPLIER`).

On a quiet ledger the base fee is 100 stroops, so the default bid is 1,000
stroops — 0.0001 XLM — and the network takes 100 of it. During surge pricing
that same bid is what keeps the transaction landing instead of coming back
rejected.

The default is deliberately *not* the SDK's `BASE_FEE` constant. That constant
is the network minimum: the floor of the auction, not a sensible bid. A
transaction built at the floor is the first one dropped when a ledger fills.

### Overriding it

```tsx
const { send } = useSendPayment()

// Bid harder during known congestion.
await send({ to, asset: "XLM", amount: "10", feeMultiplier: 50 })

// Or pin the fee exactly, in stroops. This wins over everything else.
await send({ to, asset: "XLM", amount: "10", fee: "100000" })
```

| Option | Type | Description |
| :--- | :--- | :--- |
| `fee` | `string` | Explicit fee in stroops, per operation. Used verbatim; no multiplier is applied and Horizon is not asked for a base fee. |
| `feeMultiplier` | `number` | Multiplies the base fee fetched from Horizon. Defaults to `10`. |

Precedence: `fee` → `feeMultiplier` × fetched base fee → `10` × fetched base fee.

### When the base fee cannot be fetched

If Horizon cannot be reached to read the current base fee, the call fails with
a `NETWORK_ERROR` rather than falling back to the network minimum.

That is on purpose. The conditions that make Horizon unreachable overlap with
the conditions that make a minimum-fee transaction fail, so falling back would
submit the least competitive bid possible at exactly the worst moment — and do
it silently. Pass an explicit `fee` if you need to proceed without Horizon.

### When the bid was too low anyway

A transaction rejected for its fee surfaces as `FEE_TOO_LOW`, not a generic
failure:

```tsx
const { send, error } = useSendPayment()

if (error?.code === "FEE_TOO_LOW") {
  // "The fee was too low for the current network conditions. Retry with a
  //  higher fee or feeMultiplier."
}
```

Retry with a higher `feeMultiplier`. Fee bumping — resubmitting an
already-signed envelope at a higher fee — is not supported yet.

## What happens when Freighter opens

When you call `send()`, the hook builds an unsigned transaction from your
`SendPaymentOptions`, then hands it to the connected wallet adapter to sign.
For Freighter, this opens the Freighter browser extension popup showing the
transaction details: the destination, the asset, the amount, and the memo
if you set one.

The popup pauses execution. `loading` stays `true` until the user responds.
If the user approves, Freighter signs the transaction and returns it to
`send()`, which then submits it to the network. If the user rejects or
closes the popup, `send()` throws a `StellarError` with the code
`WALLET_REQUEST_REJECTED` and nothing is submitted.

## What to do on timeout (HTTP 504)

When Horizon receives a transaction, it holds the connection open while waiting
for the transaction to be included in a ledger. Ledgers close every ~5 seconds,
but under load Horizon gives up first and returns **HTTP 504 Gateway Timeout**
— while the transaction is still in the queue and may succeed in the next ledger.

**A 504 means "I don't know", not "it failed".** Treating it as a failure and
retrying can cause a double-send, where both transactions succeed and the user
pays twice.

### How this library handles 504

When `send()` receives a 504, it throws a `StellarError` with:
- `code: "TX_TIMEOUT"`
- `hash: "<transaction_hash>"` — the hash is computed **before** submission, so it's available even when Horizon times out.

The transaction may still succeed. Use the hash to poll `useTransaction(hash)`
and find out what actually happened.

### Example: polling after timeout

```tsx
import { useSendPayment, useTransaction } from "use-stellar"
import { useState } from "react"

function SendWithTimeoutHandling() {
  const { send, loading, error } = useSendPayment()
  const [pollHash, setPollHash] = useState<string | null>(null)
  
  // Poll for the transaction status if we have a hash
  const { transaction } = useTransaction({ hash: pollHash })

  const handleSend = async () => {
    try {
      await send({
        to: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
        asset: "XLM",
        amount: "10",
      })
    } catch (err: any) {
      if (err.code === "TX_TIMEOUT") {
        // Set the hash so useTransaction starts polling
        setPollHash(err.hash)
      }
    }
  }

  if (pollHash && transaction) {
    if (transaction.status === "success") {
      return <p>Payment succeeded! Hash: {pollHash}</p>
    }
    if (transaction.status === "failed") {
      return <p>Payment failed. Safe to retry with a new transaction.</p>
    }
  }

  if (pollHash) {
    return <p>Horizon timed out. Checking if the payment succeeded...</p>
  }

  return (
    <div>
      <button onClick={handleSend} disabled={loading}>
        {loading ? "Sending..." : "Send 10 XLM"}
      </button>
      {error && error.code !== "TX_TIMEOUT" && (
        <p>Error: {error.message}</p>
      )}
    </div>
  )
}
```

### Why resubmitting is dangerous

The Stellar protocol's safeguard is the sequence number. Each transaction is
bound to one, and the network rejects any second transaction reusing it.

- **Safe:** Resubmitting the identical signed envelope. It's either the same
  transaction (a no-op) or rejected as a duplicate sequence number.
- **Unsafe:** Building a new transaction and signing it fresh. This gets a
  **new sequence number**, and the network will happily execute both
  transactions if the first one succeeded.

This library does not currently provide a retry helper. If you need one, it
must resubmit the identical signed XDR, never rebuild with fresh options.

### When tx_bad_seq means it's safe to retry

If you receive `SEQUENCE_MISMATCH` (transaction result code `tx_bad_seq`), it
means the transaction definitively did **not** execute. In this case, it is
safe to:
1. Reload the source account with `useAccount` to get the current sequence number
2. Build a completely new transaction
3. Sign and submit again

`tx_bad_seq` is the network's explicit confirmation that your sequence number
was wrong and nothing happened.

## TypeScript

```ts
interface SendPaymentOptions {
  to: string
  asset: Asset
  amount: string
  memo?: string
}

interface SendPaymentResult {
  hash: string
  status: "pending" | "success" | "failed" | "not_found"
}

interface UseSendPaymentReturn {
  send: (options: SendPaymentOptions) => Promise<SendPaymentResult>
  loading: boolean
  error: StellarError | null
  result: SendPaymentResult | null
  reset: () => void
}
```

## Common errors

| Error code                 | Cause                                                              | Fix                                                                 |
| --------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------|
| `WALLET_NOT_CONNECTED`      | `send()` was called before a wallet was connected.                  | Call `connect()` from `useWallet` first, and check `wallet.connected` before calling `send()`. |
| `WALLET_REQUEST_REJECTED`   | The user rejected the transaction, or closed the Freighter popup.   | Treat this as a normal cancellation. Do not retry automatically.    |
| `WRONG_NETWORK`             | The wallet is on a different network than the `StellarProvider`.    | Ask the user to switch their wallet's network, or call `refreshWalletNetwork()`. |
| `ACCOUNT_NOT_FOUND`         | The source account is not funded on this network.                   | Fund the source account. On testnet, use Friendbot.                 |
| `INSUFFICIENT_BALANCE`      | The source account does not hold enough of the asset to send.       | Reduce the amount, or fund the account with more of the asset.      |
| `NO_TRUSTLINE`               | The destination account has not established a trustline for the asset. | The destination must add a trustline for the asset before you can send it. Does not apply to XLM. |
| `TRANSACTION_FAILED`        | The transaction was submitted but rejected by the network.          | Check `error.raw` for the underlying Horizon response and inspect the failure reason. |
| `TX_TIMEOUT`                | Horizon timed out (504) before confirming the transaction was included in a ledger. The transaction may still succeed. | Use the transaction hash (`error.hash`) to poll `useTransaction(hash)` and determine the actual outcome. See [What to do on timeout](#what-to-do-on-timeout-http-504). |
| `SEQUENCE_MISMATCH`         | The transaction's sequence number did not match the source account's current sequence. | This means the transaction definitively did not execute. Reload the account and rebuild the transaction with the correct sequence number. |
| `RATE_LIMITED`               | Horizon rate-limited the request.                                    | Wait before retrying. Avoid calling `send()` in a tight loop.       |
| `VALIDATION_ERROR`          | Input was invalid, or `send()` was called outside a browser (e.g. during server-side rendering). | Move the calling component behind a `"use client"` boundary in Next.js / Remix, and validate input before calling `send()`. |
| `NETWORK_ERROR`              | A transport-level failure — offline, DNS, timeout, or CORS.          | Check the user's network connection and retry.                      |

## Calling reset() before a new send

`error` and `result` persist after a `send()` call finishes. If you let a
user submit a second payment without clearing them, your UI can show a
stale error or a stale success message from the previous send.

Call `reset()` immediately before starting a new `send()` call, as shown in
[Example 3](#example-3--a-full-form-with-state-management) and
[Example 4](#example-4--handling-rejection).

## Mainnet warning

Every example on this page uses testnet. Never copy a mainnet address or
a mainnet asset issuer into a testnet example, and never run these
examples against `mainnet` in `StellarProvider` without independently
verifying the destination address and the amount. `send()` moves real
funds on mainnet, and a payment to the wrong address cannot be reversed.

## Notes

- `send()` throws on failure in addition to setting `error`. If you call
  `send()` without a `try`/`catch`, an unhandled promise rejection can
  surface in your app. Either wrap the call in `try`/`catch`, as shown in
  [Example 4](#example-4--handling-rejection), or rely on the hook's
  `error` return value and ignore the thrown value.
- `send()` waits for the transaction to submit successfully before
  resolving. It does not wait for the transaction to be confirmed as
  `success` versus `failed` beyond what Horizon's submit response
  reports.
- Each call to `send()` loads the source account fresh from Horizon, so
  sequence numbers stay correct even if you call `send()` multiple times
  in a row.

## Related hooks

- [`useWallet`](./use-wallet.md) — connect a wallet before calling `send()`.
- [`useAsset`](./use-asset.md) — look up asset metadata before sending an issued asset.
