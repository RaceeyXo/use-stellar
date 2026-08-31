# useFederationLookup

Resolves a Stellar federation address (e.g. `alice*example.com`) to the underlying Stellar account ID and optional memo.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useFederationLookup } from "use-stellar"
```

## What is a federation address?

A federation address is a human-readable alias in the form `name*domain` that maps to a Stellar account ID. For example, `alice*stellar.org` resolves to an account like `GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN`. The `*` separator is mandatory — a string without one is not a valid federation address.

Some federation records also include a `memo` and `memoType`. If the destination requires a memo (common with exchange accounts), you must include it when sending a payment, or the funds may be unrecoverable.

## Basic usage

```tsx
import { useFederationLookup } from "use-stellar"

function FederationResolver() {
  const { record, loading, error } = useFederationLookup({
    address: "alice*testanchor.stellar.org",
  })

  if (loading) return <p>Resolving…</p>
  if (error) return <p>Error: {error.message}</p>
  if (!record) return null

  return (
    <div>
      <p>Account: {record.accountId}</p>
      {record.memo && <p>Memo ({record.memoType}): {record.memo}</p>}
    </div>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | `null` | The federation address to resolve, in `name*domain` format. Leading and trailing whitespace is trimmed automatically. When `null`, `undefined`, or an empty string, the hook stays idle. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `record` | `FederationRecord \| null` | The resolved federation record, or `null` while loading, idle, or on error. |
| `loading` | `boolean` | `true` while the federation server is being contacted. |
| `error` | `StellarError \| null` | Set when the address fails format validation or the federation lookup fails. `null` otherwise. |
| `refetch` | `() => Promise<void>` | Re-runs the lookup with the current address. |

### `FederationRecord` shape

| Field | Type | Description |
| :--- | :--- | :--- |
| `stellarAddress` | `string` | The original federation address that was resolved. |
| `accountId` | `string` | The Stellar account ID (`G...`) the address maps to. |
| `memoType` | `string \| undefined` | The type of memo required by the destination, if any (e.g. `"text"`, `"id"`). |
| `memo` | `string \| undefined` | The memo value that must accompany payments to this account, if required. |

## Examples

### Example 1 — resolve a federation address and display the result

```tsx
import { useFederationLookup } from "use-stellar"

function ResolvedAccount() {
  const { record, loading, error } = useFederationLookup({
    address: "alice*testanchor.stellar.org",
  })

  if (loading) return <p>Resolving federation address…</p>
  if (error) return <p>Could not resolve: {error.message}</p>
  if (!record) return null

  return (
    <div>
      <p>
        <strong>{record.stellarAddress}</strong> resolves to:
      </p>
      <code>{record.accountId}</code>
      {record.memo && (
        <p>
          Required memo ({record.memoType}): <strong>{record.memo}</strong>
        </p>
      )}
    </div>
  )
}
```

### Example 2 — resolve from user input

Drive the lookup reactively from an input field. The hook re-runs automatically whenever `address` changes.

```tsx
import { useState } from "react"
import { useFederationLookup } from "use-stellar"

function FederationInput() {
  const [input, setInput] = useState("")
  const { record, loading, error } = useFederationLookup({
    address: input || null,
  })

  return (
    <div>
      <label>
        Federation address
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="alice*example.com"
        />
      </label>

      {loading && <p>Resolving…</p>}

      {error && (
        <p style={{ color: "red" }}>
          {error.code === "VALIDATION_ERROR"
            ? "Enter a valid federation address (name*domain)."
            : error.message}
        </p>
      )}

      {record && (
        <div>
          <p>Account ID: <code>{record.accountId}</code></p>
          {record.memo && (
            <p>Memo required: <strong>{record.memo}</strong> ({record.memoType})</p>
          )}
        </div>
      )}
    </div>
  )
}
```

### Example 3 — use the resolved account ID in a payment

If the resolved record includes a memo, pass it to `useSendPayment` along with the account ID.

```tsx
import { useState } from "react"
import { useFederationLookup, useSendPayment } from "use-stellar"

function PayToFederationAddress() {
  const [fedAddress, setFedAddress] = useState("")
  const { record, loading: resolving, error: resolveError } = useFederationLookup({
    address: fedAddress || null,
  })
  const { send, loading: sending, error: sendError, result } = useSendPayment()

  const handleSend = async () => {
    if (!record) return
    await send({
      to: record.accountId,
      asset: "XLM",
      amount: "10",
      memo: record.memo,
    })
  }

  return (
    <div>
      <input
        value={fedAddress}
        onChange={e => setFedAddress(e.target.value)}
        placeholder="alice*example.com"
      />
      {resolving && <p>Resolving…</p>}
      {resolveError && <p style={{ color: "red" }}>Could not resolve: {resolveError.message}</p>}
      {record && (
        <div>
          <p>Resolved to: <code>{record.accountId}</code></p>
          <button onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send 10 XLM"}
          </button>
        </div>
      )}
      {sendError && <p style={{ color: "red" }}>Send failed: {sendError.message}</p>}
      {result && <p>Sent. Hash: {result.hash}</p>}
    </div>
  )
}
```

### Example 4 — handling errors and retrying

```tsx
import { useFederationLookup } from "use-stellar"

function FederationWithRetry() {
  const { record, loading, error, refetch } = useFederationLookup({
    address: "alice*testanchor.stellar.org",
  })

  if (loading) return <p>Resolving…</p>

  if (error) {
    return (
      <div>
        <p>Lookup failed: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  if (!record) return null

  return <p>Account: {record.accountId}</p>
}
```

## TypeScript

```ts
interface FederationRecord {
  stellarAddress: string
  accountId: string
  memoType?: string
  memo?: string
}

interface UseFederationLookupOptions {
  address?: string | null
}

interface UseFederationLookupReturn {
  record: FederationRecord | null
  loading: boolean
  error: StellarError | null
  refetch: () => Promise<void>
}
```

## Common errors

| Error code | Cause | Fix |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | The `address` string does not match the `name*domain` pattern (the `*` separator is missing, or there are multiple `*` characters). | Validate user input before passing it to the hook. Require a single `*` character. |
| `NETWORK_ERROR` | The federation server for the domain could not be reached. | Check the user's network connection. Not all domains host a federation server. |
| `UNKNOWN` | The federation server returned an unexpected response or the address was not found in its records. | Verify the address is registered with the domain's federation server. |

## Notes

- This hook does **not** use `StellarContext`. It does not read the active network from `StellarProvider` and does not call Horizon. Federation resolution is a DNS + HTTPS lookup against the domain in the address, and is network-agnostic.
- The address is trimmed of leading and trailing whitespace before validation and lookup. `" alice*example.com "` is treated the same as `"alice*example.com"`.
- The format check (`name*domain`) runs synchronously before any network call. An address without `*` is rejected immediately with a `VALIDATION_ERROR`, and `loading` stays `false`.
- The hook uses a monotonic request ID internally. If `address` changes while a lookup is in flight, the stale response is silently discarded.
- If the resolved record includes `memo` and `memoType`, you must include the memo when sending a payment to that account. Omitting a required memo on an exchange account can result in funds that cannot be attributed to your account.

## Related hooks

- [`useSendPayment`](./use-send-payment.md) — send a payment to the resolved `accountId`, including the `memo` if present.
- [`useAccountExists`](./use-account-exists.md) — confirm the resolved account ID is funded before sending.
