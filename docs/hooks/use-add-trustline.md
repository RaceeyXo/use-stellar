# useAddTrustline

Builds, signs, and submits a `changeTrust` transaction that establishes a trustline for an issued asset, allowing the connected account to hold it.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useAddTrustline } from "use-stellar"
```

## Basic usage

This example runs as-is inside an app already wrapped in `StellarProvider`, with a wallet already connected via `useWallet`.

```tsx
import { useAddTrustline } from "use-stellar"

function TrustUSDC() {
  const { addTrustline, loading, error, result } = useAddTrustline()

  const handleClick = async () => {
    await addTrustline({
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK",
      },
    })
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Adding trustline…" : "Trust USDC"}
      </button>
      {error && <p>Error: {error.message}</p>}
      {result && <p>Trustline added. Hash: {result.hash}</p>}
    </div>
  )
}
```

## Parameters

`useAddTrustline` takes no parameters. Call the hook with no arguments, then call the `addTrustline` function it returns with an `AddTrustlineOptions` object.

### `AddTrustlineOptions`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `asset` | `IssuedAsset` | Yes | The issued asset to trust. Must have both `code` and `issuer`. XLM is not valid here — a trustline for XLM makes no sense on Stellar. |
| `limit` | `string` | No | The maximum amount of the asset this account is willing to hold. Omit to use the Stellar default (no effective limit). Pass `"0"` to remove an existing trustline. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `addTrustline` | `(options: AddTrustlineOptions) => Promise<TransactionResult>` | Builds, signs, and submits the `changeTrust` transaction. Throws a `StellarError` on failure and also sets `error`. |
| `loading` | `boolean` | `true` while the transaction is being built, signed, or submitted. |
| `error` | `StellarError \| null` | The error from the most recent `addTrustline()` call, or `null`. |
| `result` | `TransactionResult \| null` | The result of the most recent successful `addTrustline()` call, or `null`. |
| `reset` | `() => void` | Clears `error` and `result`. Call this before starting a new `addTrustline()` call so stale state does not confuse your UI. |

## Examples

### Example 1 — trust an issued asset with no limit

The most common case: allow the account to hold any amount of an asset.

```tsx
import { useAddTrustline } from "use-stellar"

function TrustAsset() {
  const { addTrustline, loading, result } = useAddTrustline()

  const handleClick = async () => {
    await addTrustline({
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK",
      },
    })
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Submitting…" : "Add USDC trustline"}
      </button>
      {result && <p>Done. Tx hash: {result.hash}</p>}
    </div>
  )
}
```

### Example 2 — trust with a spending limit

Pass `limit` to cap how much of the asset this account can hold.

```tsx
import { useAddTrustline } from "use-stellar"

function TrustWithLimit() {
  const { addTrustline, loading, error } = useAddTrustline()

  const handleClick = async () => {
    await addTrustline({
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK",
      },
      limit: "1000",
    })
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Submitting…" : "Trust up to 1000 USDC"}
      </button>
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

### Example 3 — a full flow with wallet gate and error handling

Always check that the wallet is connected before calling `addTrustline()`. The hook throws if you call it without a connected wallet, but checking first lets you give the user a clearer message.

```tsx
import { useAddTrustline } from "use-stellar"
import { useWallet } from "use-stellar"

function TrustlineManager() {
  const { connected, connect } = useWallet()
  const { addTrustline, loading, error, result, reset } = useAddTrustline()

  if (!connected) {
    return (
      <div>
        <p>Connect your wallet to add a trustline.</p>
        <button onClick={() => connect("freighter")}>Connect Freighter</button>
      </div>
    )
  }

  const handleClick = async () => {
    reset()
    try {
      await addTrustline({
        asset: {
          code: "USDC",
          issuer: "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK",
        },
      })
    } catch {
      // error is available via the hook's `error` return value
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Waiting for signature…" : "Trust USDC"}
      </button>
      {result && (
        <p style={{ color: "green" }}>
          Trustline added. Hash: <code>{result.hash}</code>
        </p>
      )}
      {error?.code === "WALLET_REQUEST_REJECTED" && (
        <p>You declined the transaction. No changes were made.</p>
      )}
      {error && error.code !== "WALLET_REQUEST_REJECTED" && (
        <p style={{ color: "red" }}>Error: {error.message}</p>
      )}
    </div>
  )
}
```

### Example 4 — handling errors and retrying

```tsx
import { useAddTrustline, useWallet } from "use-stellar"

function RetryableTrustline() {
  const { addTrustline, loading, error, reset } = useAddTrustline()

  const asset = {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK",
  }

  const handleClick = async () => {
    reset()
    await addTrustline({ asset })
  }

  if (error) {
    return (
      <div>
        <p>Something went wrong: {error.message}</p>
        <button onClick={handleClick}>Try again</button>
      </div>
    )
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? "Submitting…" : "Add trustline"}
    </button>
  )
}
```

## What happens when Freighter opens

When you call `addTrustline()`, the hook loads your account from Horizon to get the current sequence number, builds a `changeTrust` transaction, and passes it to the connected wallet adapter to sign. For Freighter, this opens the Freighter browser extension popup showing the transaction details.

The popup pauses execution. `loading` stays `true` until the user responds. If the user approves, Freighter signs the transaction and `addTrustline()` submits it to the network. If the user rejects or closes the popup, `addTrustline()` throws a `StellarError` with code `WALLET_REQUEST_REJECTED` and nothing is submitted.

## TypeScript

```ts
interface IssuedAsset {
  code: string
  issuer: string
}

interface AddTrustlineOptions {
  asset: IssuedAsset
  limit?: string
}

interface TransactionResult {
  hash: string
  status: "pending" | "success" | "failed" | "not_found"
  ledger?: number
  createdAt?: string
  fee?: string
  envelope?: string
}

interface UseAddTrustlineReturn {
  addTrustline: (options: AddTrustlineOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
```

## Common errors

| Error code | Cause | Fix |
| :--- | :--- | :--- |
| `WALLET_NOT_CONNECTED` | `addTrustline()` was called before a wallet was connected, or no wallet adapter was selected. | Call `connect()` from `useWallet` first and check `wallet.connected` before calling `addTrustline()`. |
| `WALLET_REQUEST_REJECTED` | The user rejected the transaction or closed the Freighter popup. | Treat this as a normal cancellation. Do not retry automatically. |
| `WRONG_NETWORK` | The wallet's active network does not match the network set in `StellarProvider`. | Ask the user to switch their wallet's network to match, or call `refreshWalletNetwork()`. |
| `VALIDATION_ERROR` | `asset` was XLM (trustlines only apply to issued assets), or `addTrustline()` was called outside a browser context (e.g. during server-side rendering in Next.js). | Pass a valid `IssuedAsset` with `code` and `issuer`. In Next.js, move the calling component behind a `"use client"` boundary. |
| `ACCOUNT_NOT_FOUND` | The connected wallet address is not funded on this network. | Fund the account. On testnet, use [Friendbot](https://laboratory.stellar.org/#friendbot). |
| `TRANSACTION_FAILED` | The transaction was submitted but rejected by the network. | Inspect `error.raw` for the Horizon failure response. |
| `NETWORK_ERROR` | A transport-level failure — offline, DNS, timeout, or CORS. | Check the user's network connection and retry. |

## Calling reset() before a new call

`error` and `result` persist after `addTrustline()` finishes. If the user adds a second trustline without you clearing them first, your UI can show a stale error or a stale success message from the previous call.

Call `reset()` immediately before starting a new `addTrustline()` call, as shown in [Example 3](#example-3--a-full-flow-with-wallet-gate-and-error-handling).

## Notes

- `addTrustline()` throws on failure in addition to setting `error`. Wrap the call in `try`/`catch` or rely on the hook's `error` return value — you need one or the other to avoid unhandled promise rejections.
- The hook uses `BASE_FEE` (100 stroops) from `@stellar/stellar-sdk` as the transaction fee. This is hardcoded today. See [#9](https://github.com/RaceeyXo/use-stellar/issues/9) — fee handling is being revisited in a later wave.
- The hook is browser-only. Transaction signing requires the wallet extension. Calling `addTrustline()` in a server component or during SSR throws immediately with `VALIDATION_ERROR`.
- Each `addTrustline()` call loads the source account fresh from Horizon, so the sequence number is always current.
- Passing `limit: "0"` removes the trustline entirely (provided the account holds a zero balance of that asset). This is standard Stellar `changeTrust` behaviour.

## Related hooks

- [`useWallet`](./use-wallet.md) — connect a wallet before calling `addTrustline()`.
- [`useBalance`](./use-balance.md) — check whether a trustline already exists by inspecting the `balances` array.
- [`useSendPayment`](./use-send-payment.md) — once the trustline is in place, use this to send the asset.
