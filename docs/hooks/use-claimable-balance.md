# useClaimableBalance

Fetches the list of claimable balances available to a Stellar account.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useClaimableBalance } from "use-stellar"
```

## Basic usage

```tsx
import { useClaimableBalance } from "use-stellar"

function ClaimableBalanceList() {
  const { balances, loading, error } = useClaimableBalance()

  if (loading) return <p>Loading claimable balances…</p>
  if (error) return <p>Error: {error.message}</p>
  if (balances.length === 0) return <p>No claimable balances found.</p>

  return (
    <ul>
      {balances.map(b => (
        <li key={b.id}>
          {b.amount} {b.asset}
        </li>
      ))}
    </ul>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | Connected wallet address | The Stellar address to query claimable balances for. Defaults to the address of the connected wallet. |

When `address` is `null` and no wallet is connected, the hook returns an empty `balances` array and does nothing.

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `balances` | `ClaimableBalance[]` | The list of claimable balances for the address. Empty array while loading, on error, or when none exist. |
| `loading` | `boolean` | `true` while the Horizon request is in flight. |
| `error` | `StellarError \| null` | Set when an unexpected error occurs. `null` on success and when the account simply has no claimable balances. |
| `refetch` | `() => void` | Re-runs the query with the current address. |

### `ClaimableBalance` shape

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | The unique balance ID on the ledger. |
| `asset` | `string` | The asset in Stellar's canonical `CODE:ISSUER` format, or `"native"` for XLM. |
| `amount` | `string` | The claimable amount, as a string. |
| `claimants` | `ClaimableBalanceClaimant[]` | The list of accounts that can claim this balance and their predicates. |
| `sponsor` | `string \| undefined` | The account that created the claimable balance, if recorded. |

### `ClaimableBalanceClaimant` shape

| Field | Type | Description |
| :--- | :--- | :--- |
| `destination` | `string` | The Stellar address that is allowed to claim this balance. |
| `predicate` | `object` | The raw Horizon predicate object describing when the claim is valid. The structure matches the Horizon API response directly. |

## Examples

### Example 1 — list claimable balances for the connected wallet

```tsx
import { useClaimableBalance } from "use-stellar"

function MyClaimableBalances() {
  const { balances, loading, error } = useClaimableBalance()

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  if (balances.length === 0) {
    return <p>You have no claimable balances on this network.</p>
  }

  return (
    <div>
      <h3>Claimable Balances</h3>
      <ul>
        {balances.map(b => (
          <li key={b.id}>
            <strong>{b.amount}</strong> {b.asset}
            {b.sponsor && <span> (sponsored by {b.sponsor.slice(0, 8)}…)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Example 2 — query a specific address

Pass an explicit `address` to check claimable balances for any account, not just the connected wallet.

```tsx
import { useClaimableBalance } from "use-stellar"

function AddressClaimableBalances() {
  const { balances, loading, error } = useClaimableBalance({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
  })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {balances.map(b => (
        <li key={b.id}>
          {b.amount} {b.asset}
        </li>
      ))}
    </ul>
  )
}
```

### Example 3 — handling errors and retrying

```tsx
import { useClaimableBalance } from "use-stellar"

function ClaimableBalancesWithRetry() {
  const { balances, loading, error, refetch } = useClaimableBalance()

  if (loading) return <p>Loading…</p>

  if (error) {
    return (
      <div>
        <p>Could not load claimable balances: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return (
    <div>
      {balances.length === 0 ? (
        <p>No claimable balances.</p>
      ) : (
        <ul>
          {balances.map(b => (
            <li key={b.id}>
              {b.amount} {b.asset}
            </li>
          ))}
        </ul>
      )}
      <button onClick={refetch}>Refresh</button>
    </div>
  )
}
```

## TypeScript

```ts
interface ClaimableBalanceClaimant {
  destination: string
  predicate: object
}

interface ClaimableBalance {
  id: string
  asset: string
  amount: string
  claimants: ClaimableBalanceClaimant[]
  sponsor?: string
}

interface UseClaimableBalanceOptions {
  address?: string | null
}

interface UseClaimableBalanceReturn {
  balances: ClaimableBalance[]
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

**Note:** a Horizon 404 for an account with no claimable balances is not surfaced as an error. The hook converts it into an empty `balances` array and leaves `error` as `null`.

## Notes

- The hook fetches automatically on mount and re-fetches whenever `address` or the active network changes.
- The hook uses a monotonic request ID internally. If `address` or network changes while a fetch is in flight, the stale response is silently discarded.
- `balances` is always an array — never `null`. Check `balances.length === 0` rather than checking for `null`.
- The `asset` field is the raw Horizon string (e.g. `"USDC:GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV"` or `"native"`). It is not normalized into the `Asset` union type used by other hooks. Parse it yourself if you need the code and issuer separately.
- The `predicate` field on each claimant is passed through as a raw object from the Horizon response. The Horizon API predicate structure can be complex; refer to the [Stellar documentation](https://developers.stellar.org/docs/learn/glossary#claimable-balance) for the full predicate schema.
- The hook does not provide a claim action. Claiming a claimable balance is a transaction operation — raise a request or contribute a `useClaimBalance` mutation hook if you need that functionality.

## Related hooks

- [`useBalance`](./use-balance.md) — Fetches the regular (non-claimable) balances held by an account.
- [`useAccount`](./use-account.md) — Fetches full account detail including subentry count, which reflects trustlines and other ledger entries.
