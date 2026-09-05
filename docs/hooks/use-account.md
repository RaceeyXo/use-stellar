# useAccount

Fetches full account information for a Stellar address, including all balances, sequence number, signers, and multisig thresholds.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useAccount } from "use-stellar"
```

## Basic usage

```tsx
import { useAccount } from "use-stellar"

function Example() {
  const { account, loading, error } = useAccount()

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>
  if (!account) return <p>No account found.</p>

  return (
    <div>
      <p>Sequence: {account.sequence}</p>
      <p>Balances: {account.balances.length}</p>
    </div>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | Connected wallet address | The Stellar address to fetch. When omitted or `null`, the hook uses the address of the currently connected wallet. Pass an explicit address to inspect any account on the network. |

### address

When you call `useAccount()` without any arguments, it resolves to the address of the wallet connected via `useWallet`. If no wallet is connected and no address is supplied, the hook does nothing — `loading` stays `false` and `account` stays `null`.

Pass an explicit address to inspect a different account without requiring a wallet connection:

```tsx
const { account } = useAccount({ address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5" })
```

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `account` | `AccountInfo \| null` | The full account record. `null` while loading, if no address is resolved, or if the fetch failed. |
| `loading` | `boolean` | `true` while a request is in flight. |
| `error` | `StellarError \| null` | A typed error object if the request failed, otherwise `null`. |
| `refetch` | `() => void` | Call this to manually re-run the fetch. |

### AccountInfo fields

Every field in the `AccountInfo` object is documented below.

| Field | Type | Description |
| :--- | :--- | :--- |
| `address` | `string` | The Stellar public key (G-address) of the account. |
| `sequence` | `string` | The current sequence number of the account. Stellar requires each transaction to use the next sequence number in order. Returned as a string to avoid JavaScript integer overflow on very large values. |
| `balances` | `Balance[]` | All balances held by this account. Each element is a discriminated union covering XLM, issued assets, and liquidity pool shares. See the [Balance shape](#balance-shape) section below. |
| `subentryCount` | `number` | The number of ledger subentries attached to this account. Each trustline, offer, data entry, or signer beyond the account's own key costs one subentry. Each subentry reserves 0.5 XLM of the minimum balance. |
| `thresholds.lowThreshold` | `number` | The minimum combined signer weight required to authorise low-threshold operations (e.g. bumping sequence, setting flags). |
| `thresholds.medThreshold` | `number` | The minimum combined signer weight required to authorise medium-threshold operations (e.g. payments, trustlines, offers). |
| `thresholds.highThreshold` | `number` | The minimum combined signer weight required to authorise high-threshold operations (e.g. adding or removing signers, merging accounts). |
| `signers` | `{ key: string; weight: number; type: string }[]` | All signing keys authorised on the account. The master key is included with its current weight. |
| `signers[].key` | `string` | The Stellar public key of this signer. |
| `signers[].weight` | `number` | The weight assigned to this signer. A weight of `0` disables the signer. |
| `signers[].type` | `string` | The type of signer key, as returned by Horizon (e.g. `"ed25519_public_key"`). |

### Balance shape

`balances` is a typed discriminated union. Narrow by `entry.asset` to access asset-specific fields:

| Shape | When | Extra fields |
| :--- | :--- | :--- |
| `{ asset: "XLM"; balance: string }` | Native XLM | — |
| `{ asset: { code: string; issuer: string }; balance: string; limit: string }` | Issued asset (e.g. USDC) | `limit` — the maximum amount this account trusts to hold. |
| `{ asset: "liquidity_pool_shares"; balance: string; liquidityPoolId: string }` | Liquidity pool position | `liquidityPoolId` — the pool identifier. |

### subentryCount and minimum balance

Stellar requires every account to maintain a minimum XLM balance that increases with each subentry. The formula is:

```
minimum balance = (2 + subentryCount) × 0.5 XLM
```

A fresh account with no subentries must hold at least 1 XLM. Each trustline, open offer, or additional signer raises that floor by 0.5 XLM. Read `subentryCount` before allowing users to send XLM so you can warn them when a transaction would breach the minimum.

## Examples

### Example 1 — Display full account information

Render the sequence number, subentry count, and every balance for the connected wallet.

```tsx
import { useAccount } from "use-stellar"

export function AccountInfoPanel() {
  const { account, loading, error } = useAccount()

  if (loading) return <p>Loading account...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!account) return <p>Connect your wallet to see account details.</p>

  return (
    <div>
      <h2>Account Details</h2>
      <p>
        <strong>Address:</strong> <code>{account.address}</code>
      </p>
      <p>
        <strong>Sequence:</strong> {account.sequence}
      </p>
      <p>
        <strong>Subentries:</strong> {account.subentryCount} (minimum balance:{" "}
        {(2 + account.subentryCount) * 0.5} XLM)
      </p>

      <h3>Balances</h3>
      <ul>
        {account.balances.map((entry, i) => {
          if (entry.asset === "XLM") {
            return <li key={i}><strong>XLM:</strong> {entry.balance}</li>
          }
          if (entry.asset === "liquidity_pool_shares") {
            return (
              <li key={i}>
                <strong>LP Shares</strong> ({entry.liquidityPoolId.slice(0, 8)}…):{" "}
                {entry.balance}
              </li>
            )
          }
          return (
            <li key={i}>
              <strong>{entry.asset.code}</strong> (issuer:{" "}
              {entry.asset.issuer.slice(0, 8)}…): {entry.balance} / limit:{" "}
              {entry.limit}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

### Example 2 — Check whether an account is multisig

An account is multisig when it has more than one signer with a weight greater than zero. This example reads the signers array and thresholds to determine that.

```tsx
import { useAccount } from "use-stellar"

export function MultisigStatus() {
  const { account, loading, error } = useAccount()

  if (loading) return <p>Checking multisig status...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!account) return <p>Connect your wallet first.</p>

  const activeSigners = account.signers.filter((s) => s.weight > 0)
  const isMultisig = activeSigners.length > 1

  return (
    <div>
      <h2>Multisig Status</h2>
      <p>
        <strong>Multisig:</strong> {isMultisig ? "Yes" : "No"}
      </p>
      <p>
        <strong>Active signers:</strong> {activeSigners.length}
      </p>
      <p>
        <strong>Thresholds</strong> — low: {account.thresholds.lowThreshold} /{" "}
        med: {account.thresholds.medThreshold} / high:{" "}
        {account.thresholds.highThreshold}
      </p>

      <h3>Signers</h3>
      <ul>
        {activeSigners.map((signer) => (
          <li key={signer.key}>
            <code>{signer.key.slice(0, 8)}…</code> — weight: {signer.weight} (
            {signer.type})
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Example 3 — Inspect a different address

Pass an explicit address to fetch the account for any Stellar public key, not just the connected wallet.

```tsx
import { useAccount } from "use-stellar"

export function InspectAccount() {
  const address = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
  const { account, loading, error, refetch } = useAccount({ address })

  if (loading) return <p>Loading...</p>

  if (error) {
    return (
      <div>
        <p style={{ color: "red" }}>Failed to load: {error.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    )
  }

  if (!account) return null

  return (
    <div>
      <h2>Account: {account.address.slice(0, 10)}…</h2>
      <p>Sequence: {account.sequence}</p>
      <p>Subentries: {account.subentryCount}</p>
      <p>Balances: {account.balances.length}</p>
    </div>
  )
}
```

### Example 4 — List all balances and handle errors with retry

This example renders every balance type and gives the user a way to recover from errors.

```tsx
import { useAccount } from "use-stellar"

export function AllBalances() {
  const { account, loading, error, refetch } = useAccount()

  if (loading) return <p>Loading balances...</p>

  if (error) {
    return (
      <div>
        <p style={{ color: "red" }}>Error: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  if (!account) {
    return <p>Connect your wallet to see your balances.</p>
  }

  return (
    <div>
      <h2>All Balances</h2>
      {account.balances.length === 0 ? (
        <p>No balances found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Balance</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {account.balances.map((entry, i) => {
              if (entry.asset === "XLM") {
                return (
                  <tr key={i}>
                    <td>XLM</td>
                    <td>{entry.balance}</td>
                    <td>Native</td>
                  </tr>
                )
              }

              if (entry.asset === "liquidity_pool_shares") {
                return (
                  <tr key={i}>
                    <td>LP Shares</td>
                    <td>{entry.balance}</td>
                    <td>Pool: {entry.liquidityPoolId.slice(0, 12)}…</td>
                  </tr>
                )
              }

              return (
                <tr key={i}>
                  <td>{entry.asset.code}</td>
                  <td>{entry.balance}</td>
                  <td>
                    Issuer: {entry.asset.issuer.slice(0, 8)}… / Limit:{" "}
                    {entry.limit}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

## TypeScript

```ts
interface UseAccountOptions {
  address?: string | null
}

interface UseAccountReturn {
  account: AccountInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

interface AccountInfo {
  address: string
  sequence: string
  balances: Balance[]
  subentryCount: number
  thresholds: {
    lowThreshold: number
    medThreshold: number
    highThreshold: number
  }
  signers: {
    key: string
    weight: number
    type: string
  }[]
}

type Balance =
  | { asset: "XLM"; balance: string }
  | { asset: { code: string; issuer: string }; balance: string; limit: string }
  | { asset: "liquidity_pool_shares"; balance: string; liquidityPoolId: string }
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `"The requested account or resource could not be found on the ledger."` | The address has never received a funding transaction and does not exist on the ledger. | Fund the account using [Friendbot](https://laboratory.stellar.org/#friendbot) on testnet, or send at least 1 XLM to activate it. |
| `"Unable to reach the Stellar network. Check your connection and try again."` | The Horizon server is unreachable. | Check your internet connection and confirm `StellarProvider` is configured with the correct network. |
| `account` is `null` with no error and `loading` is `false` | No address was resolved — no wallet is connected and no `address` was passed. | Either connect a wallet with `useWallet` or pass an explicit `address` option. |

## Notes

- **Sequence numbers:** `sequence` is returned as a `string` to avoid JavaScript integer-overflow on accounts with a very high sequence number. Parse it with `BigInt(account.sequence)` if you need to do arithmetic.
- **Minimum balance:** Every ledger subentry reserves 0.5 XLM. The formula `(2 + account.subentryCount) × 0.5` gives the minimum XLM the account must always hold. Warn users before they send an amount that would drop their balance below this floor.
- **Race condition safety:** If `address` changes while a request is in flight, the stale response is silently discarded. Only the result matching the most recent address is applied to state.
- **No polling:** `useAccount` fetches once when the component mounts and again whenever `address` or the network changes. It does not poll automatically. Call `refetch` to refresh, or pair with a polling mechanism if live updates are required.
- **SSR compatibility:** When an `address` is supplied, the hook can run on the server side (Next.js App Router). When relying on the connected wallet address, it only resolves in the browser after the wallet connects.

## Related hooks

- [`useBalance`](./use-balance.md) — Fetches only the balance for a single asset, with optional polling. Lighter-weight when you do not need signers or thresholds.
- [`useSendPayment`](./use-send-payment.md) — Signs and submits a payment. Uses the sequence number managed by Horizon automatically.
- [`useNetwork`](./use-network.md) — Exposes the active network name and Horizon URL used by all hooks.
