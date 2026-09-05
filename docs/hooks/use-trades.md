# useTrades

Fetches executed trades (fills) from Horizon's `/trades` endpoint, with pagination and stable base/counter orientation.

Use this hook to build fill history ("did my order execute?"), price charts from real trade data, and portfolio P&L calculations. Trades are the completed matches — distinct from the open offers in an order book.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useTrades } from "use-stellar"
```

## Basic usage

```tsx
import { useTrades } from "use-stellar"

function TradeHistory() {
  const { trades, loading, error } = useTrades({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
  })

  if (loading) return <p>Loading trades...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {trades.map(trade => (
        <li key={trade.id}>
          {trade.side === "sell" ? "Sold" : "Bought"} {trade.baseAmount}{" "}
          {trade.baseAsset === "XLM" ? "XLM" : trade.baseAsset.code} @{" "}
          {trade.price} ({trade.ledgerCloseTime})
        </li>
      ))}
    </ul>
  )
}
```

## Parameters

| Parameter      | Type                 | Required | Default    | Description                                                                                       |
| -------------- | -------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `address`      | `string \| null`     | No       | Connected wallet | Stellar account address. Filters trades to those involving this account. Also used to compute `side` on each trade. Defaults to the connected wallet address when omitted. |
| `baseAsset`    | `Asset \| null`      | No       | —          | The asset you want as the base of every returned trade. Must be paired with `counterAsset` to enable the asset-pair filter. Also defines the orientation rule — see **Base/counter orientation** below. |
| `counterAsset` | `Asset \| null`      | No       | —          | The asset you want as the counter of every returned trade. Must be paired with `baseAsset`.       |
| `limit`        | `number`             | No       | `10`       | Number of trades per page.                                                                        |
| `order`        | `"asc" \| "desc"`    | No       | `"desc"`   | Sort order. `"desc"` returns the most recent trades first.                                        |

At least one of `address` or `baseAsset` must be provided. The hook returns an empty list without calling Horizon when neither is set.

## Return values

| Property    | Type                    | Description                                                                              |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `trades`    | `NormalizedTrade[]`     | The current page of normalized trades. Empty while loading or when no results exist.    |
| `loading`   | `boolean`               | `true` while the request is in flight.                                                   |
| `error`     | `StellarError \| null`  | A typed error if the request failed, otherwise `null`.                                   |
| `hasNext`   | `boolean`               | `true` when a next page is available.                                                    |
| `hasPrev`   | `boolean`               | `true` when a previous page is available.                                                |
| `fetchNext` | `() => Promise<void>`   | Load the next page of trades.                                                            |
| `fetchPrev` | `() => Promise<void>`   | Load the previous page of trades.                                                        |
| `refetch`   | `() => void`            | Re-fetch the current page from Horizon.                                                  |

## NormalizedTrade shape

```ts
interface NormalizedTrade {
  id: string
  ledgerCloseTime: string        // ISO-8601 ledger close time
  tradeType: "orderbook" | "liquidity_pool"
  baseAsset: Asset               // Always the asset you requested as base
  baseAmount: string             // Amount of base asset exchanged
  counterAsset: Asset            // Always the asset you requested as counter
  counterAmount: string          // Amount of counter asset exchanged
  priceR: { n: number; d: number } // Exact rational: n/d = counterAmount/baseAmount
  price: string                  // Precise decimal string, for display only
  side?: "buy" | "sell"          // Present only when filtering by account
  baseIsSeller: boolean          // Raw Horizon base_is_seller flag
}
```

## Examples

### Filter by account (fill history)

Show every trade an account participated in, most recent first.

```tsx
import { useTrades } from "use-stellar"

function AccountFillHistory() {
  const { trades, loading, error, hasNext, fetchNext } = useTrades({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
    limit: 20,
    order: "desc",
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <ul>
        {trades.map(trade => {
          const base = trade.baseAsset === "XLM" ? "XLM" : trade.baseAsset.code
          const counter =
            trade.counterAsset === "XLM" ? "XLM" : trade.counterAsset.code
          return (
            <li key={trade.id}>
              {trade.side === "sell"
                ? `Sold ${trade.baseAmount} ${base} for ${trade.counterAmount} ${counter}`
                : `Bought ${trade.baseAmount} ${base} with ${trade.counterAmount} ${counter}`}{" "}
              @ {trade.price} — {trade.ledgerCloseTime}
            </li>
          )
        })}
      </ul>
      {hasNext && (
        <button onClick={fetchNext}>Load more</button>
      )}
    </div>
  )
}
```

### Filter by asset pair (price chart data)

Fetch the last 50 XLM/USDC trades to build a price series. `baseAsset` and `counterAsset` together enable the asset-pair filter, and every record is oriented with XLM as base.

```tsx
import { useTrades } from "use-stellar"

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

function XlmUsdcPriceHistory() {
  const { trades, loading, error } = useTrades({
    baseAsset: "XLM",
    counterAsset: { code: "USDC", issuer: USDC_ISSUER },
    limit: 50,
    order: "desc",
  })

  if (loading) return <p>Loading price data...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>XLM sold</th>
          <th>USDC received</th>
          <th>Price (USDC/XLM)</th>
        </tr>
      </thead>
      <tbody>
        {trades.map(trade => (
          <tr key={trade.id}>
            <td>{trade.ledgerCloseTime}</td>
            <td>{trade.baseAmount}</td>
            <td>{trade.counterAmount}</td>
            <td>{trade.price}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### Filter by both account and asset pair

Find all XLM/USDC trades for a specific account to show P&L on that pair.

```tsx
import { useTrades } from "use-stellar"

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

function AccountPairHistory() {
  const { trades, loading, error } = useTrades({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
    baseAsset: "XLM",
    counterAsset: { code: "USDC", issuer: USDC_ISSUER },
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {trades.map(trade => (
        <li key={trade.id}>
          {trade.side === "sell"
            ? `Sold ${trade.baseAmount} XLM @ ${trade.price} USDC/XLM`
            : `Bought ${trade.baseAmount} XLM @ ${trade.price} USDC/XLM`}
        </li>
      ))}
    </ul>
  )
}
```

### Paginated fill history with prev/next

```tsx
import { useTrades } from "use-stellar"

function PaginatedFills() {
  const {
    trades,
    loading,
    error,
    hasNext,
    hasPrev,
    fetchNext,
    fetchPrev,
    refetch,
  } = useTrades({
    address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
    limit: 10,
  })

  if (loading) return <p>Loading...</p>

  if (error) {
    return (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return (
    <div>
      <ul>
        {trades.map(trade => (
          <li key={trade.id}>
            {trade.id} — {trade.price} — {trade.ledgerCloseTime}
          </li>
        ))}
      </ul>
      <div>
        <button onClick={fetchPrev} disabled={!hasPrev}>← Newer</button>
        <button onClick={fetchNext} disabled={!hasNext}>Older →</button>
      </div>
    </div>
  )
}
```

## Base/counter orientation

Horizon assigns base and counter assets using Stellar's canonical asset ordering, which is independent of how you queried. This means the same logical trade can be returned with either asset as base depending on the request.

`useTrades` normalizes every record so that `baseAsset` is always the asset you passed as `baseAsset` in the options. When Horizon returns a record with your requested base as the counter, the hook:

1. Swaps `baseAsset` ↔ `counterAsset`.
2. Swaps `baseAmount` ↔ `counterAmount`.
3. Inverts the price rational: `{ n: old_d, d: old_n }`.

This means `price` always expresses the cost in counter units per one base unit in the orientation you asked for.

When no `baseAsset` is provided (account-only filter), Horizon's canonical orientation is used unchanged.

## Price precision

`priceR` is the exact rational `{ n, d }` from Horizon. `price` is derived from `priceR` using integer arithmetic only — no floating-point conversion occurs anywhere in the hook. Use `price` for display; use `priceR` for any computation that requires an exact representation.

## `side` computation

`side` is only set when the hook is filtering by account (`address` option). The value is derived from `base_is_seller` and whether the queried account is the base or counter participant:

| Account position | `base_is_seller` | `side`   |
| ---------------- | ---------------- | -------- |
| base             | `true`           | `"sell"` |
| base             | `false`          | `"buy"`  |
| counter          | `true`           | `"buy"`  |
| counter          | `false`          | `"sell"` |

`side` is `undefined` when no account filter is active (pure asset-pair queries).

## Liquidity-pool trades

Horizon's `/trades` endpoint returns both orderbook trades and liquidity-pool trades. This hook includes all of them. Inspect `trade.tradeType` to distinguish:

- `"orderbook"` — a DEX offer match between two accounts.
- `"liquidity_pool"` — a swap against an AMM liquidity pool.

If your UI only needs one type, filter the `trades` array by `tradeType` after fetching.

## Pagination

Pagination uses the cursor embedded in Horizon's `next()` and `prev()` functions, which carry the correct paging token. Stale cursor refs are cleared whenever any query parameter changes (address, assets, limit, order), so navigating to a different account or pair always starts from page one rather than resuming mid-stream from an old cursor.

## TypeScript

```ts
import type { NormalizedTrade, UseTradesOptions, UseTradesReturn } from "use-stellar"
```

Full interfaces:

```ts
interface UseTradesOptions {
  address?: string | null
  baseAsset?: Asset | null
  counterAsset?: Asset | null
  limit?: number
  order?: "asc" | "desc"
}

interface UseTradesReturn {
  trades: NormalizedTrade[]
  loading: boolean
  error: StellarError | null
  hasNext: boolean
  hasPrev: boolean
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  refetch: () => void
}

interface NormalizedTrade {
  id: string
  ledgerCloseTime: string
  tradeType: "orderbook" | "liquidity_pool"
  baseAsset: Asset
  baseAmount: string
  counterAsset: Asset
  counterAmount: string
  priceR: { n: number; d: number }
  price: string
  side?: "buy" | "sell"
  baseIsSeller: boolean
}
```

## Common errors

| Error code         | Cause                                                      | Fix                                                                                        |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ACCOUNT_NOT_FOUND`| The address has never traded or does not exist on the network. | Verify the address is funded on testnet with [Friendbot](https://laboratory.stellar.org/#friendbot). |
| `NETWORK_ERROR`    | Horizon is unreachable or returned a server error.         | Check your network connection. The hook will surface the error in `error.message`.         |
| `UNKNOWN`          | An unexpected error occurred.                              | Inspect `error.message` for details. Call `refetch()` to retry.                            |

## Notes

- Results for the first page are cached in the shared `QueryStore`. Subsequent `fetchNext` / `fetchPrev` calls are not cached — they go directly to Horizon.
- Neither `fetchNext` nor `fetchPrev` has any effect before the first page has loaded (the Horizon cursor functions are not yet available).
- When neither `address` nor `baseAsset` is provided, the hook is in a disabled state and returns empty data immediately without calling Horizon.
- Liquidity-pool trades may not include `base_account` or `counter_account` fields. The `side` field will be `undefined` for those records even when filtering by account.

## Related hooks

- [`usePayments`](./use-payments.md) — paginated payment history for an account.
- [`useAccount`](./use-account.md) — full account info including balances.
