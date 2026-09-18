# usePayments

Fetches a paginated list of payment operations for a Stellar account, normalized into a consistent shape regardless of the underlying operation type.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { usePayments } from "use-stellar"
```

## Basic usage

```tsx
import { usePayments } from "use-stellar"

function PaymentList() {
  const { payments, loading, error, hasNext, fetchNext } = usePayments()

  if (loading) return <p>Loading payments…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <ul>
        {payments.map(p => (
          <li key={p.id}>
            {p.direction === "incoming" ? "+" : "-"}
            {p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
          </li>
        ))}
      </ul>
      {hasNext && <button onClick={fetchNext}>Load more</button>}
    </div>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | Connected wallet address | The Stellar address to fetch payments for. Defaults to the connected wallet address. |
| `limit` | `number` | No | `10` | Number of payment records to fetch per page. |
| `order` | `"asc" \| "desc"` | No | `"desc"` | Sort order. `"desc"` returns the most recent payments first. |
| `cursor` | `string` | No | `undefined` | A Horizon paging token. When provided, the first page starts from this cursor position. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `payments` | `NormalizedPayment[]` | The current page of normalized payment records. Empty array while loading, on error, or when no address is available. |
| `loading` | `boolean` | `true` while any fetch (initial, next page, previous page) is in flight. |
| `error` | `StellarError \| null` | Set when a request fails. `null` on success. |
| `refetch` | `() => void` | Re-runs the initial query from scratch. Resets pagination to the first page. |
| `fetchNext` | `() => Promise<void>` | Fetches the next page. Does nothing if there is no next page. |
| `fetchPrev` | `() => Promise<void>` | Fetches the previous page. Does nothing if there is no previous page. |
| `hasNext` | `boolean` | `true` if there is likely a next page. See [Pagination behaviour](#pagination-behaviour). |
| `hasPrev` | `boolean` | `true` if there is a previous page to go back to. |

### `NormalizedPayment` shape

Six Horizon operation types are fetched by this hook (`payment`, `create_account`, `account_merge`, `path_payment_strict_receive`, `path_payment_strict_send`, `invoke_host_function`). All are normalized into the same shape:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | The operation ID from Horizon. |
| `txHash` | `string` | The hash of the transaction this operation belongs to. |
| `type` | `string` | The raw Horizon operation type string (e.g. `"payment"`, `"create_account"`). |
| `from` | `string` | The sending account address. |
| `to` | `string` | The receiving account address. |
| `amount` | `string` | The amount transferred, as a string. `"0"` for `account_merge` operations. |
| `asset` | `Asset` | The asset transferred. `"XLM"` for native, or `{ code, issuer }` for issued assets. |
| `direction` | `"incoming" \| "outgoing"` | Whether the payment was received by or sent from the queried address. |
| `createdAt` | `string` | ISO 8601 timestamp from Horizon. |

## Examples

### Example 1 — paginated payment list for the connected wallet

```tsx
import { usePayments } from "use-stellar"

function PaymentHistory() {
  const { payments, loading, error, hasNext, hasPrev, fetchNext, fetchPrev, refetch } =
    usePayments({ limit: 10 })

  if (loading) return <p>Loading…</p>

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    )
  }

  if (payments.length === 0) return <p>No payments found.</p>

  return (
    <div>
      <ul>
        {payments.map(p => (
          <li key={p.id}>
            <span>{p.direction === "incoming" ? "↓ Received" : "↑ Sent"}</span>
            {" "}
            <strong>{p.amount}</strong>{" "}
            {p.asset === "XLM" ? "XLM" : p.asset.code}
            {" — "}
            <small>{new Date(p.createdAt).toLocaleString()}</small>
          </li>
        ))}
      </ul>
      <div>
        <button onClick={fetchPrev} disabled={!hasPrev || loading}>
          Previous
        </button>
        <button onClick={fetchNext} disabled={!hasNext || loading}>
          Next
        </button>
      </div>
    </div>
  )
}
```

### Example 2 — fetch payments for a specific address

```tsx
import { usePayments } from "use-stellar"

function AddressPayments() {
  const { payments, loading, error } = usePayments({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
    limit: 5,
    order: "desc",
  })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {payments.map(p => (
        <li key={p.id}>
          {p.direction}: {p.amount}{" "}
          {p.asset === "XLM" ? "XLM" : p.asset.code}
        </li>
      ))}
    </ul>
  )
}
```

### Example 3 — distinguish incoming from outgoing

```tsx
import { usePayments } from "use-stellar"

function SplitPayments() {
  const { payments, loading } = usePayments({ limit: 20 })

  if (loading) return <p>Loading…</p>

  const incoming = payments.filter(p => p.direction === "incoming")
  const outgoing = payments.filter(p => p.direction === "outgoing")

  return (
    <div style={{ display: "flex", gap: 32 }}>
      <div>
        <h4>Received ({incoming.length})</h4>
        <ul>
          {incoming.map(p => (
            <li key={p.id}>
              +{p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4>Sent ({outgoing.length})</h4>
        <ul>
          {outgoing.map(p => (
            <li key={p.id}>
              -{p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

### Example 4 — handling errors and retrying

```tsx
import { usePayments } from "use-stellar"

function PaymentsWithRetry() {
  const { payments, loading, error, refetch } = usePayments()

  if (loading) return <p>Loading…</p>

  if (error) {
    return (
      <div>
        <p>Could not load payments: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return (
    <ul>
      {payments.map(p => (
        <li key={p.id}>
          {p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
        </li>
      ))}
    </ul>
  )
}
```

## Pagination behaviour

`hasNext` is set to `true` when the number of records returned by Horizon equals `limit`. This is a heuristic — it does not guarantee a next page exists, but it avoids an extra round-trip. If you call `fetchNext` and get back an empty page, `hasNext` will become `false`.

`hasPrev` is `true` whenever a `cursor` was in use when the current page was fetched (i.e. you have already navigated forward at least once).

Calling `refetch` resets pagination — it re-runs the initial query and clears the stored `next`/`prev` page references.

## TypeScript

```ts
interface UsePaymentsOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
}

interface NormalizedPayment {
  id: string
  txHash: string
  type: string
  from: string
  to: string
  amount: string
  asset: Asset  // "XLM" | { code: string; issuer: string }
  direction: "incoming" | "outgoing"
  createdAt: string
}

interface UsePaymentsReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}
```

## Common errors

| Error code | Cause | Fix |
| :--- | :--- | :--- |
| `ACCOUNT_NOT_FOUND` | The address has no operations on this network (account not funded). | Fund the account. On testnet, use [Friendbot](https://laboratory.stellar.org/#friendbot). |
| `NETWORK_ERROR` | Horizon was unreachable — offline, DNS failure, or timeout. | Check the network connection and call `refetch()`. |
| `RATE_LIMITED` | Horizon returned a 429. | Wait before calling `refetch()`. Do not call `fetchNext` in a tight loop. |

## Notes

- `invoke_host_function` operations (Soroban contract calls) are included in the results when they appear in the account's payment stream. The `from` and `to` fields will be empty strings for these operations because Horizon does not expose a simple sender/receiver for contract invocations. The `amount` will be `"0"`.
- `account_merge` operations always have `amount: "0"` because the source account's entire remaining balance is swept to `to`, and Horizon does not report the swept amount in the operation record itself.
- For `path_payment_strict_receive` and `path_payment_strict_send`, `direction` determines which amount and asset are reported. If you received the payment, `amount` and `asset` reflect what you received. If you sent it, they reflect what you sent (the source asset and amount).
- The hook does not deduplicate. If the same operation appears on multiple pages due to a cursor edge case, it will appear twice in your UI. Use `id` as the React `key`.
- If `usePaymentHistory` better matches your use case (you want to filter by direction or asset), use that hook instead — it wraps this one.

## Related hooks

- [`usePaymentHistory`](./use-payment-history.md) — wraps `usePayments` and adds client-side filtering by direction and asset.
- [`useTransactionHistory`](./use-transaction-history.md) — fetches full transactions rather than individual payment operations.
- [`useSendPayment`](./use-send-payment.md) — sends a new payment.
