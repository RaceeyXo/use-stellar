# useStreamPayments

Live-tails an account's incoming and outgoing payments over Horizon's Server-Sent Events, so you can show "did the money arrive yet?" within a ledger close instead of polling.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useStreamPayments } from "use-stellar"
```

## Basic usage

```tsx
import { useStreamPayments } from "use-stellar"

function Example() {
  const { payments, connected } = useStreamPayments()

  return (
    <div>
      <p>{connected ? "Live" : "Reconnecting..."}</p>
      <ul>
        {payments.map(payment => (
          <li key={payment.id}>
            {payment.direction === "incoming" ? "+" : "-"}
            {payment.amount} {payment.asset === "XLM" ? "XLM" : payment.asset.code}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `address` | `string` | No | Connected wallet address | The Stellar address to stream payments for. |
| `cursor` | `string \| "now"` | No | `"now"` | Where to resume the stream from. `"now"` streams only payments that arrive after mount; a paging token resumes from that point. |
| `bufferSize` | `number` | No | `50` | Maximum number of records kept in memory, newest first. Older records are dropped once the buffer is full. |
| `enabled` | `boolean` | No | `true` | Set to `false` to open no connection at all. Flipping an open connection to `false` closes it. |

### cursor

`useStreamPayments` is a live tail, not a history API — use [`usePayments`](./use-payments.md) to page through past payments. Pass a paging token you persisted from a previous session's `cursor` return value to resume a stream without a gap; pass `"now"` (the default) to only see payments that happen from this point forward.

### bufferSize

An open stream on a busy account grows without bound if nothing trims it. `bufferSize` caps how many records `payments` holds — the oldest entries are dropped as new ones arrive. Raise it if your UI needs a longer live history, or read from `usePayments` for anything beyond a live tail.

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `payments` | `NormalizedPayment[]` | Newest first, bounded by `bufferSize`. |
| `connected` | `boolean` | `true` while the SSE connection is open. |
| `error` | `StellarError \| null` | Set when the connection drops. Cleared on the next successful message. A deliberate close (unmount, `enabled: false`, `reconnect()`) never sets this. |
| `cursor` | `string \| null` | The last paging token seen. Persist it to resume the stream across sessions. |
| `reconnect` | `() => void` | Closes the current connection (if any) and opens a fresh one from `cursor`. |
| `clear` | `() => void` | Empties the buffered `payments` list without closing the connection. |

## Reconnection

A dropped SSE connection is not a permanent failure — Horizon connections close for all sorts of ordinary reasons (a proxy timeout, a network blip). `useStreamPayments` reconnects automatically with jittered exponential backoff, resuming from the last cursor it saw so a reconnect never loses an event that arrived in the gap.

```tsx
function LiveFeed() {
  const { payments, connected, error } = useStreamPayments()

  return (
    <div>
      {!connected && <p>{error ? error.message : "Connecting..."}</p>}
      <ul>
        {payments.map(p => (
          <li key={p.id}>{p.amount}</li>
        ))}
      </ul>
    </div>
  )
}
```

## SSR

SSE is browser-only. On the server this hook opens no connection and returns an inert result (`payments: []`, `connected: false`) rather than throwing — safe to render in a Next.js server component tree.

## Examples

### Example 1 — Checkout page waiting for a payment

```tsx
import { useStreamPayments } from "use-stellar"

export function CheckoutStatus({ expectedAmount }: { expectedAmount: string }) {
  const { payments } = useStreamPayments()
  const paid = payments.some(p => p.direction === "incoming" && p.amount === expectedAmount)

  return <p>{paid ? "Payment received!" : "Waiting for payment..."}</p>
}
```

### Example 2 — Resuming a stream across page loads

```tsx
import { useEffect, useState } from "react"
import { useStreamPayments } from "use-stellar"

export function ResumableFeed() {
  const [savedCursor] = useState(() => localStorage.getItem("payments-cursor") ?? "now")
  const { payments, cursor } = useStreamPayments({ cursor: savedCursor })

  useEffect(() => {
    if (cursor) localStorage.setItem("payments-cursor", cursor)
  }, [cursor])

  return (
    <ul>
      {payments.map(p => (
        <li key={p.id}>{p.amount}</li>
      ))}
    </ul>
  )
}
```

## TypeScript

```ts
interface UseStreamPaymentsOptions {
  address?: string
  cursor?: string | "now"
  bufferSize?: number
  enabled?: boolean
}

interface UseStreamPaymentsReturn {
  payments: NormalizedPayment[]
  connected: boolean
  error: StellarError | null
  cursor: string | null
  reconnect: () => void
  clear: () => void
}
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `"Payment stream connection lost. Reconnecting…"` | The SSE connection dropped (network blip, proxy timeout). | Nothing to do — the hook reconnects automatically with backoff. Show `connected` in your UI if you want to surface it. |

## Notes

- `normalizePayment` — the same normalizer `usePayments` uses — is shared between both hooks, so a Soroban `invoke_host_function` transfer never shows up as a blank row in one but not the other.
- Calling `reconnect()` resets the backoff attempt counter and resumes from the current `cursor`, not from `"now"` — it will not skip events that arrived since the last message.

## Related hooks

- [`usePayments`](./use-payments.md) — Fetches paginated payment history. Use this for anything beyond a live tail.
- [`useBalance`](./use-balance.md) — Fetches the current XLM or asset balance, with optional interval polling.
