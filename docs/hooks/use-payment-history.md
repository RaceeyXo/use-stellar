# usePaymentHistory

Fetches a paginated, client-side-filtered list of payment operations for a Stellar account. Wraps [`usePayments`](./use-payments.md) and adds `direction` and `asset` filter options.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { usePaymentHistory } from "use-stellar"
```

## Basic usage

```tsx
import { usePaymentHistory } from "use-stellar"

function IncomingPayments() {
  const { payments, loading, error } = usePaymentHistory({
    direction: "incoming",
  })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {payments.map(p => (
        <li key={p.id}>
          +{p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
          {" — "}
          {new Date(p.createdAt).toLocaleDateString()}
        </li>
      ))}
    </ul>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string \| null` | No | Connected wallet address | The Stellar address to fetch payments for. Defaults to the connected wallet address. |
| `limit` | `number` | No | `10` | Number of records to request from Horizon per page, before filtering. |
| `order` | `"asc" \| "desc"` | No | `"desc"` | Sort order. `"desc"` returns the most recent payments first. |
| `cursor` | `string` | No | `undefined` | A Horizon paging token to start from. |
| `direction` | `"incoming" \| "outgoing" \| "all"` | No | `"all"` | Filter by payment direction after fetching. `"all"` returns both. |
| `asset` | `Asset \| "all"` | No | `"all"` | Filter by asset after fetching. Pass `"XLM"` for native, `{ code, issuer }` for an issued asset, or `"all"` to skip filtering. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `payments` | `NormalizedPayment[]` | The filtered payments for the current page. |
| `loading` | `boolean` | `true` while any fetch is in flight. |
| `error` | `StellarError \| null` | Set when a request fails. `null` on success. |
| `refetch` | `() => void` | Re-runs the initial query from scratch and resets pagination. |
| `fetchNext` | `() => Promise<void>` | Fetches the next page of results from Horizon, then applies the current filters. |
| `fetchPrev` | `() => Promise<void>` | Fetches the previous page, then applies the current filters. |
| `hasNext` | `boolean` | `true` only when the filtered result is non-empty **and** Horizon indicated a next page exists. See [Filtering and pagination](#filtering-and-pagination). |
| `hasPrev` | `boolean` | `true` if there is a previous page to go back to. |

The `NormalizedPayment` shape is identical to the one returned by `usePayments`. See [usePayments → NormalizedPayment shape](./use-payments.md#normalizedpayment-shape).

## Examples

### Example 1 — show only incoming XLM payments

```tsx
import { usePaymentHistory } from "use-stellar"

function IncomingXLM() {
  const { payments, loading, error, hasNext, fetchNext } = usePaymentHistory({
    direction: "incoming",
    asset: "XLM",
    limit: 10,
  })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>
  if (payments.length === 0) return <p>No incoming XLM payments yet.</p>

  return (
    <div>
      <ul>
        {payments.map(p => (
          <li key={p.id}>
            +{p.amount} XLM — {new Date(p.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
      {hasNext && <button onClick={fetchNext}>Load more</button>}
    </div>
  )
}
```

### Example 2 — filter by an issued asset

```tsx
import { usePaymentHistory } from "use-stellar"

function USDCHistory() {
  const { payments, loading, error, hasNext, hasPrev, fetchNext, fetchPrev } =
    usePaymentHistory({
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK",
      },
      limit: 20,
    })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <h3>USDC Payment History</h3>
      {payments.length === 0 ? (
        <p>No USDC payments on this page.</p>
      ) : (
        <ul>
          {payments.map(p => (
            <li key={p.id}>
              {p.direction === "incoming" ? "+" : "-"}
              {p.amount} USDC — {new Date(p.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      )}
      <div>
        <button onClick={fetchPrev} disabled={!hasPrev}>Previous</button>
        <button onClick={fetchNext} disabled={!hasNext}>Next</button>
      </div>
    </div>
  )
}
```

### Example 3 — all payments with no filter

```tsx
import { usePaymentHistory } from "use-stellar"

function AllPayments() {
  const { payments, loading, error, hasNext, fetchNext } = usePaymentHistory({
    limit: 10,
  })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <ul>
        {payments.map(p => (
          <li key={p.id}>
            {p.direction === "incoming" ? "↓" : "↑"}{" "}
            {p.amount}{" "}
            {p.asset === "XLM" ? "XLM" : p.asset.code}
          </li>
        ))}
      </ul>
      {hasNext && <button onClick={fetchNext}>More</button>}
    </div>
  )
}
```

### Example 4 — handling errors and retrying

```tsx
import { usePaymentHistory } from "use-stellar"

function PaymentHistoryWithRetry() {
  const { payments, loading, error, refetch } = usePaymentHistory({
    direction: "outgoing",
  })

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
          -{p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
        </li>
      ))}
    </ul>
  )
}
```

## Filtering and pagination

**Filtering is client-side.** `usePaymentHistory` calls `usePayments` with your `limit`, then filters the returned page in memory using `useMemo`. This means:

- A page of 10 records from Horizon may produce fewer than 10 filtered results — or zero — if most records do not match your filters.
- `hasNext` accounts for this: if the filtered result for the current page is **empty**, `hasNext` is forced to `false` even if Horizon reported a next page. This prevents your UI from looping through pages indefinitely looking for matches that do not exist on the current filter.
- If you need reliable page sizes after filtering, increase `limit` to over-fetch, or use `usePayments` directly and filter in your own component.

> **Note:** The interaction between client-side filtering and server-side pagination is being tracked. See [state-06](https://github.com/RaceeyXo/use-stellar/issues) and [state-07](https://github.com/RaceeyXo/use-stellar/issues) — those issues may change how `hasNext` behaves in a future release.

## TypeScript

```ts
interface UsePaymentHistoryOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
  direction?: "incoming" | "outgoing" | "all"
  asset?: Asset | "all"  // Asset = "XLM" | { code: string; issuer: string }
}

interface UsePaymentHistoryReturn {
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

- Filtering happens in `useMemo` — it does not trigger additional network requests. Changing `direction` or `asset` while the hook is mounted re-filters the already-fetched page immediately.
- If you pass `direction: "all"` and `asset: "all"` (or omit both), this hook behaves identically to `usePayments`.
- The `asset` filter matches on both `code` and `issuer`. Passing `{ code: "USDC", issuer: "G..." }` will not match a USDC issued by a different account.

## Related hooks

- [`usePayments`](./use-payments.md) — the underlying hook this one wraps. Use it directly when you do not need direction or asset filtering.
- [`useTransactionHistory`](./use-transaction-history.md) — fetches full transactions rather than individual payment operations.
