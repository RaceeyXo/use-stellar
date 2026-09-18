# useAccountExists

Checks whether a Stellar account exists and is funded on the network.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useAccountExists } from "use-stellar"
```

## Basic usage

```tsx
import { useAccountExists } from "use-stellar"

function AccountChecker() {
  const { exists, reason, loading, error } = useAccountExists({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
  })

  if (loading) return <p>Checking account...</p>
  if (error) return <p>Error: {error.message}</p>

  if (reason === "invalid_format") return <p>That address is not a valid Stellar address.</p>
  if (reason === "not_funded") return <p>Account does not exist on this network yet.</p>
  if (reason === "exists") return <p>Account is active.</p>

  return null
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | `null` | The Stellar address to check. When `null` or `undefined`, the hook stays idle. |

The hook takes no required parameters. Passing an empty options object or no argument at all is valid — the hook starts in the `"idle"` state and does nothing until you supply an address.

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `exists` | `boolean \| null` | `true` if the account is funded, `false` if not funded or the address is invalid, `null` while loading or idle. |
| `reason` | `AccountExistsReason` | A machine-readable string explaining the current state. See [reason values](#reason-values) below. |
| `loading` | `boolean` | `true` while the Horizon request is in flight. |
| `error` | `StellarError \| null` | Set when a network or unexpected error occurs. `null` on success and on expected "not found" outcomes. |
| `refetch` | `() => void` | Re-runs the check with the current address. |

### reason values

| Value | Meaning |
| :--- | :--- |
| `"idle"` | No address was supplied. `exists` is `null`. |
| `"exists"` | The address was found on the network. `exists` is `true`. |
| `"not_funded"` | The address format is valid but the account has no funds on this network. `exists` is `false`. `error` is `null`. |
| `"invalid_format"` | The address did not pass the `isValidStellarAddress` check before any network call was made. `exists` is `false`. `error` is `null`. |

## Examples

### Example 1 — checking an address entered by the user

Validate that a destination exists before letting the user send a payment to it.

```tsx
import { useState } from "react"
import { useAccountExists } from "use-stellar"

function DestinationValidator() {
  const [input, setInput] = useState("")
  const { exists, reason, loading } = useAccountExists({ address: input || null })

  return (
    <div>
      <label>
        Destination address
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="G..."
        />
      </label>

      {loading && <p>Checking…</p>}

      {!loading && reason === "invalid_format" && (
        <p style={{ color: "red" }}>Not a valid Stellar address.</p>
      )}
      {!loading && reason === "not_funded" && (
        <p style={{ color: "orange" }}>
          Address is valid but not yet funded. Sending XLM will activate it.
        </p>
      )}
      {!loading && reason === "exists" && (
        <p style={{ color: "green" }}>Account is active. Safe to send.</p>
      )}
    </div>
  )
}
```

### Example 2 — idle state when no address is provided

When `address` is `null` or undefined, the hook does nothing.

```tsx
import { useAccountExists } from "use-stellar"

function ConditionalCheck({ address }: { address: string | null }) {
  const { exists, reason } = useAccountExists({ address })

  // reason === "idle" and exists === null until address is set
  if (reason === "idle") return <p>Enter an address to check.</p>

  return <p>Account exists: {String(exists)}</p>
}
```

### Example 3 — handling errors and retrying

Most "account does not exist" outcomes set `reason` to `"not_funded"` and leave `error` as `null`. The `error` field is only set when something unexpected goes wrong, such as a network timeout or a Horizon rate-limit response.

```tsx
import { useAccountExists } from "use-stellar"

function AccountCheckWithRetry() {
  const { exists, reason, loading, error, refetch } = useAccountExists({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
  })

  if (loading) return <p>Checking…</p>

  if (error) {
    return (
      <div>
        <p>Could not check account: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return (
    <p>
      {reason === "exists" && "Account is funded and active."}
      {reason === "not_funded" && "Account not yet funded on this network."}
      {reason === "invalid_format" && "That is not a valid Stellar address."}
    </p>
  )
}
```

## TypeScript

```ts
export type AccountExistsReason = "exists" | "not_funded" | "invalid_format" | "idle"

export interface UseAccountExistsOptions {
  address?: string | null
}

export interface UseAccountExistsReturn {
  exists: boolean | null
  reason: AccountExistsReason
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

## Common errors

| Error code | Cause | Fix |
| :--- | :--- | :--- |
| `NETWORK_ERROR` | Horizon was unreachable — offline, DNS failure, or timeout. | Check the network connection and call `refetch()` to retry. |
| `RATE_LIMITED` | Horizon returned a 429. | Wait before calling `refetch()`. Do not poll in a tight loop. |

**Note:** a Horizon 404 for an unfunded account is not surfaced as an error. The hook converts it to `reason: "not_funded"` and leaves `error` as `null`. Similarly, an invalid address format is caught before any network call and surfaces as `reason: "invalid_format"` with `error` as `null`.

## Notes

- The address format check runs synchronously before any network request. An invalid address never triggers a Horizon call, so `loading` stays `false` and the response is immediate.
- The hook uses a monotonic request ID internally. If `address` changes while a fetch is in flight, the stale response is silently discarded and the result for the latest address is used instead.
- This hook reads from `StellarContext` for the active network. It will check the address against whichever network (`testnet` or `mainnet`) your `StellarProvider` is configured for.
- `refetch` is stable across renders. It is safe to pass it to a `useEffect` dependency array without causing a loop.

## Related hooks

- [`useAccount`](./use-account.md) — Fetches full account detail (balances, sequence, signers) for an address that is already known to exist.
- [`useBalance`](./use-balance.md) — Fetches the XLM or asset balance for an address; returns `null` rather than an error when the account is not found.
- [`useAddTrustline`](./use-add-trustline.md) — Establishes a trustline once you have confirmed the account exists.
