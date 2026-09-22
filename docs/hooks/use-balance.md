# useBalance

Fetches the XLM or custom asset balance for a Stellar account.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useBalance } from "use-stellar"
```

## Basic usage

```tsx
import { useBalance } from "use-stellar"

function Example() {
  const { balance, loading, error } = useBalance()

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return <p>Your balance: {balance ?? "0"} XLM</p>
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | Connected wallet address | The Stellar address to fetch balances for. Defaults to the connected wallet. |
| `asset` | `Asset` | No | `"XLM"` | The asset to filter and return in `balance`. Can be `"XLM"` or an object specifying a custom issued asset. |
| `watch` | `boolean` | No | `false` | When set to `true`, automatically re-fetches the balances on an interval. |
| `interval` | `number` | No | `10000` | The polling interval in milliseconds when `watch` is `true`. Defaults to `10000` (10 seconds). |

### asset

The `asset` parameter determines which asset balance is filtered and returned via the `balance` return value. It supports two formats:

#### Native asset

Specify native Stellar Lumens (XLM) using the string literal:

```ts
"XLM"
```

#### Issued asset

Specify a custom issued token by passing an object containing both the asset code and its issuing account address:

```ts
{
  code: string,
  issuer: string
}
```

Both fields are required:
* `code` (e.g., `"USDC"`): The alphanumeric code of the asset.
* `issuer` (e.g., `"GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV"`): The Stellar public key of the issuing account.

### watch

The `watch` parameter enables automatic, background polling to keep the account balances up to date.

* **Purpose:** Allows real-time or periodically updated balance indicators without requiring manual page reloads or user actions.
* **Behaviour:** When enabled, the hook sets up a periodic timer that re-runs the balance fetching logic.
* **Polling interval:** Controlled by the `interval` parameter. If you pass an interval value that is less than or equal to `0`, the hook automatically overrides it to the default of `10000` ms (10 seconds) to prevent busy-looping.
* **Automatic polling:** Uses a `setInterval` in a React `useEffect` hook. To avoid state updates on unmounted components or stale polling cycles, any in-flight requests are tracked with a monotonic ID and ignored if they resolve after the hook or network configurations change.
* **Default behaviour:** Disabled (`false`).
* **When to use it:** Enable `watch` on transaction confirmation screens, user dashboards, or navigation headers where the balance must reflect active on-chain payments or transfers.

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `balance` | `string \| null` | The balance of the asset requested in the `asset` option. `null` if the trustline is missing, the account is not found, or during the initial load. |
| `balances` | `Balance[]` | An array of all balances held by the address. Each element represents a specific asset balance. |
| `loading` | `boolean` | `true` while a fetch is actively in progress. |
| `error` | `StellarError \| null` | A typed `StellarError` object if the request failed, otherwise `null`. |
| `lastUpdated` | `Date \| null` | A timestamp indicating when the balances were last successfully fetched. |
| `isStale` | `boolean` | `true` when `error` is set but `balances` still holds data from a previous successful fetch. See [Stale-while-revalidate](#stale-while-revalidate) below. |
| `refetch` | `() => void` | A function you can call to manually re-fetch the balances. |

## Stale-while-revalidate

`useBalance` never wipes good data just because a subsequent fetch failed. This
matters most with `watch: true`, which polls public Horizon on an interval —
Horizon rate-limits aggressively, so a transient failure (e.g. a `429`) is a
realistic, recurring event for any dashboard with more than one hook mounted.

* **A failed fetch keeps the last known-good `balances` and `lastUpdated` in
  place.** Only `error` is set, and `isStale` flips to `true`. The balance you
  were already showing is stale, not wrong — keep rendering it, with the error
  surfaced as a warning if you want one.
* **A successful fetch clears `error`, flips `isStale` back to `false`, and
  replaces `balances`/`lastUpdated` as normal.**
* **Changing `address` (or the network) clears `balances` immediately**, before
  the new fetch resolves — the old data belongs to a different account, so it
  is never shown, even briefly, under the new query.

```tsx
function BalanceIndicator() {
  const { balance, error, isStale } = useBalance({ watch: true })

  return (
    <div>
      <span>{balance ?? "0"} XLM</span>
      {isStale && <span title={error?.message}>showing last known balance</span>}
    </div>
  )
}
```

## Why balance is a String

Stellar balances are returned as string values rather than standard JavaScript numbers (such as `number` or `float`).

This is a deliberate design choice that prevents precision loss. JavaScript uses double-precision floating-point numbers (IEEE 754), which cannot represent extremely small or large fractional numbers with complete precision. Because Stellar is a financial ledger that supports transactions of up to seven decimal places of precision, representing balances as floating-point numbers could introduce subtle rounding errors.

By returning balances as strings, you can safely perform high-precision math using specialized libraries such as `big.js` or `bignumber.js` without losing accuracy.

## Examples

### Example 1 — Reading the native XLM balance

This example demonstrates how to read and render the native XLM balance of the connected wallet.

```tsx
import { useBalance } from "use-stellar"

export function XLMBalanceComponent() {
  const { balance, loading, error } = useBalance({
    asset: "XLM",
  })

  if (loading) return <p>Loading balance...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>

  return (
    <div>
      <h3>Native Balance</h3>
      <p>{balance ?? "0.0000000"} XLM</p>
    </div>
  )
}
```

### Example 2 — Reading a USDC balance using an issued asset

This example shows how to query the balance of a custom issued asset (testnet USDC) for a specific account address.

```tsx
import { useBalance } from "use-stellar"

export function USDCBalanceComponent() {
  const { balance, loading, error } = useBalance({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
    asset: {
      code: "USDC",
      issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
    },
  })

  if (loading) return <p>Loading USDC balance...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>

  return (
    <div>
      <h3>USDC Balance</h3>
      <p>{balance ?? "0.0000000"} USDC</p>
    </div>
  )
}
```

### Example 3 — Using the watch option for automatic polling

This example shows how to automatically poll the network for balance changes every 5 seconds.

```tsx
import { useBalance } from "use-stellar"

export function PollingBalanceComponent() {
  const { balance, loading, lastUpdated, error } = useBalance({
    watch: true,
    interval: 5000,
  })

  if (loading && !balance) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>

  return (
    <div>
      <h3>Live Balance</h3>
      <p>{balance ?? "0"} XLM</p>
      {lastUpdated && (
        <small>Last updated: {lastUpdated.toLocaleTimeString()}</small>
      )}
    </div>
  )
}
```

### Example 4 — Reading all balances for an account

This example demonstrates how to loop through and render every balance in the `balances` array, handling native assets, issued assets, and liquidity pool shares.

```tsx
import { useBalance } from "use-stellar"

export function AllBalancesComponent() {
  const { balances, loading, error, refetch } = useBalance({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
  })

  if (loading) return <p>Loading all balances...</p>
  if (error) {
    return (
      <div>
        <p style={{ color: "red" }}>Error: {error.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <h3>Account Balances</h3>
      {balances.length === 0 ? (
        <p>No balances found.</p>
      ) : (
        <ul>
          {balances.map((entry, index) => {
            if (entry.asset === "XLM") {
              return (
                <li key={index}>
                  <strong>XLM</strong>: {entry.balance} XLM
                </li>
              )
            }

            if (entry.asset === "liquidity_pool_shares") {
              return (
                <li key={index}>
                  <strong>LP Shares</strong> ({entry.liquidityPoolId.slice(0, 8)}...): {entry.balance}
                </li>
              )
            }

            return (
              <li key={index}>
                <strong>{entry.asset.code}</strong> (by {entry.asset.issuer.slice(0, 8)}...): {entry.balance}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

## TypeScript

```ts
interface UseBalanceOptions {
  address?: string | null
  asset?: Asset
  watch?: boolean
  interval?: number
}

interface UseBalanceReturn {
  balance: string | null
  balances: Balance[]
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => void
}
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `"The requested account or resource could not be found on the ledger."` | The specified Stellar address has not been funded or activated. | Fund the account address using Friendbot or send XLM to activate it. |
| `"Unable to reach the Stellar network. Check your connection and try again."` | The Horizon server is unreachable due to a network connection or configuration issue. | Verify your internet connection and check that `StellarProvider` has the correct network URL configuration. |

## No Trustline Behaviour

If the requested account exists on the ledger but has not established a trustline for the specified custom issued asset, the hook does **not** throw an error.

Instead:
* The `error` return value remains `null`.
* The `balance` return value is returned as `null`.
* The custom asset is omitted from the `balances` list.

This is the standard behavior because the account does not yet trust or hold any balance of the issued asset. You should verify whether a trustline exists by inspecting the `balances` array before initiating a transaction with that asset.

## Notes

- **Initial Load:** During the initial fetch, `balance` is `null` and `balances` is an empty array `[]`. You must handle the loading state or fallback values accordingly.
- **Background Throttling:** When using the `watch` option, background updates are throttled according to React's rendering and scheduling behaviors. Any positive `interval` below `0` is ignored and overridden to `10000` ms to safeguard performance.
- **Race Condition Safety:** If the target `address` or network environment changes while a fetch request is already in-flight, the old request is automatically cancelled/ignored using a internal monotonic request ID, ensuring your UI never displays stale balance data.

## Related hooks

- [`useAccount`](./use-account.md) — Fetches complete account detail including sequence numbers, thresholds, and signers.
- [`useSendPayment`](./use-send-payment.md) — Allows signing and sending of native or custom asset payments.
- [`useAsset`](./use-asset.md) — Fetches details and metadata about a specific issued asset.
