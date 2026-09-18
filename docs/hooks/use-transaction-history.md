# useTransactionHistory

Fetches a paginated list of transactions for a Stellar account, normalized into a consistent shape.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useTransactionHistory } from "use-stellar"
```

## Basic usage

```tsx
import { useTransactionHistory } from "use-stellar"

function TransactionList() {
  const { transactions, loading, error, hasNext, fetchNext } = useTransactionHistory()

  if (loading) return <p>Loading transactions…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <ul>
        {transactions.map(tx => (
          <li key={tx.hash}>
            <code>{tx.hash.slice(0, 12)}…</code>
            {" — "}
            {tx.operationCount} op{tx.operationCount !== 1 ? "s" : ""}
            {" — "}
            {tx.successful ? "✓" : "✗"}
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
| `address` | `string \| null` | No | Connected wallet address | The Stellar address to fetch transactions for. Defaults to the connected wallet address. |
| `limit` | `number` | No | `10` | Number of transaction records to fetch per page. |
| `order` | `"asc" \| "desc"` | No | `"desc"` | Sort order. `"desc"` returns the most recent transactions first. |
| `cursor` | `string` | No | `undefined` | A Horizon paging token. When provided, the first page starts from this cursor position. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `transactions` | `NormalizedTransaction[]` | The current page of normalized transaction records. Empty array while loading, on error, or when no address is available. |
| `loading` | `boolean` | `true` while any fetch (initial, next page, previous page) is in flight. |
| `error` | `StellarError \| null` | Set when a request fails. `null` on success. |
| `refetch` | `() => void` | Re-runs the initial query from scratch and resets pagination to the first page. |
| `fetchNext` | `() => Promise<void>` | Fetches the next page. Does nothing if there is no next page. |
| `fetchPrev` | `() => Promise<void>` | Fetches the previous page. Does nothing if there is no previous page. |
| `hasNext` | `boolean` | `true` if there is likely a next page. See [Pagination behaviour](#pagination-behaviour). |
| `hasPrev` | `boolean` | `true` if there is a previous page to go back to. |

### `NormalizedTransaction` shape

| Field | Type | Description |
| :--- | :--- | :--- |
| `hash` | `string` | The transaction hash. |
| `ledger` | `number` | The ledger sequence number the transaction was included in. |
| `createdAt` | `string` | ISO 8601 timestamp from Horizon. |
| `sourceAccount` | `string` | The Stellar address of the transaction's source account. |
| `fee` | `string` | The fee charged for this transaction, in stroops, as a string. |
| `operationCount` | `number` | The number of operations included in the transaction. |
| `successful` | `boolean` | `true` if the transaction was successfully applied to the ledger. |
| `memo` | `string \| undefined` | The transaction memo, if present. |
| `memoType` | `string \| undefined` | The memo type (e.g. `"text"`, `"id"`, `"hash"`), if a memo is present. |

## Examples

### Example 1 — paginated transaction list for the connected wallet

```tsx
import { useTransactionHistory } from "use-stellar"

function MyTransactions() {
  const {
    transactions,
    loading,
    error,
    hasNext,
    hasPrev,
    fetchNext,
    fetchPrev,
    refetch,
  } = useTransactionHistory({ limit: 10 })

  if (loading) return <p>Loading…</p>

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    )
  }

  if (transactions.length === 0) return <p>No transactions found.</p>

  return (
    <div>
      <ul>
        {transactions.map(tx => (
          <li key={tx.hash}>
            <div>
              <code>{tx.hash.slice(0, 16)}…</code>
              <span> — {tx.operationCount} operation{tx.operationCount !== 1 ? "s" : ""}</span>
              <span> — Fee: {tx.fee} stroops</span>
              <span> — {tx.successful ? "Successful" : "Failed"}</span>
            </div>
            <small>{new Date(tx.createdAt).toLocaleString()}</small>
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

### Example 2 — fetch transactions for a specific address

```tsx
import { useTransactionHistory } from "use-stellar"

function AddressTransactions() {
  const { transactions, loading, error } = useTransactionHistory({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
    limit: 5,
    order: "desc",
  })

  if (loading) return <p>Loading…</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {transactions.map(tx => (
        <li key={tx.hash}>
          <code>{tx.hash.slice(0, 12)}…</code>{" "}
          {tx.successful ? "✓ Success" : "✗ Failed"}
        </li>
      ))}
    </ul>
  )
}
```

### Example 3 — display memo when present

Some transactions carry a memo — common with exchange deposits and federation payments. Always check `memoType` before displaying or parsing `memo`.

```tsx
import { useTransactionHistory } from "use-stellar"

function TransactionsWithMemo() {
  const { transactions, loading } = useTransactionHistory({ limit: 20 })

  if (loading) return <p>Loading…</p>

  return (
    <ul>
      {transactions.map(tx => (
        <li key={tx.hash}>
          <code>{tx.hash.slice(0, 12)}…</code>
          {tx.memo && (
            <span>
              {" — "}Memo ({tx.memoType}): <em>{tx.memo}</em>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
```

### Example 4 — handling errors and retrying

```tsx
import { useTransactionHistory } from "use-stellar"

function TransactionsWithRetry() {
  const { transactions, loading, error, refetch } = useTransactionHistory()

  if (loading) return <p>Loading…</p>

  if (error) {
    return (
      <div>
        <p>Could not load transactions: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return (
    <ul>
      {transactions.map(tx => (
        <li key={tx.hash}>{tx.hash}</li>
      ))}
    </ul>
  )
}
```

## Pagination behaviour

`hasNext` is set to `true` when the number of records returned by Horizon equals `limit`. This is a heuristic — it does not guarantee a next page exists, but it avoids an extra round-trip. If you call `fetchNext` and receive an empty page, `hasNext` will become `false`.

`hasPrev` is `true` whenever you have already navigated forward (i.e. a `cursor` was in use when the current page was fetched). On the first page it is `false`.

Calling `refetch` resets pagination — it re-runs the initial query and clears the stored next/prev page references.

## TypeScript

```ts
interface UseTransactionHistoryOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
}

interface NormalizedTransaction {
  hash: string
  ledger: number
  createdAt: string
  sourceAccount: string
  fee: string
  operationCount: number
  successful: boolean
  memo?: string
  memoType?: string
}

interface UseTransactionHistoryReturn {
  transactions: NormalizedTransaction[]
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
| `ACCOUNT_NOT_FOUND` | The address has no transactions on this network (account not funded). | Fund the account. On testnet, use [Friendbot](https://laboratory.stellar.org/#friendbot). |
| `NETWORK_ERROR` | Horizon was unreachable — offline, DNS failure, or timeout. | Check the network connection and call `refetch()`. |
| `RATE_LIMITED` | Horizon returned a 429. | Wait before calling `refetch()`. Do not call `fetchNext` in a tight loop. |

## Notes

- `fee` is the fee **charged** (not the fee **bid**), in stroops, as a string. One stroop is 0.0000001 XLM. Convert to XLM with: `(Number(tx.fee) / 10_000_000).toFixed(7)`.
- `successful: false` means the transaction reached the network and was included in a ledger, but its operations were not applied (e.g. due to insufficient balance). A transaction that never left the client does not appear in this list at all.
- This hook fetches full transaction records, not individual operations. If you need payment-level detail (amounts, assets, direction), use [`usePayments`](./use-payments.md) or [`usePaymentHistory`](./use-payment-history.md) instead.
- The hook does not deduplicate. Use `hash` as the React `key`.
- Transactions are fetched using `server.transactions().forAccount()` from `@stellar/stellar-sdk`. This queries the Horizon REST API and is subject to Horizon's rate limits and data availability.

## Related hooks

- [`usePayments`](./use-payments.md) — fetches individual payment operations with amount, asset, and direction.
- [`usePaymentHistory`](./use-payment-history.md) — wraps `usePayments` with direction and asset filtering.
- [`useTransaction`](./use-transaction.md) — fetches and watches a single transaction by hash.
