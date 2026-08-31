# useContractEvents

Subscribes to the events a Soroban contract emits.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useContractEvents } from "use-stellar"
```

## What a contract event is

A Soroban event is the on-chain equivalent of a log line: structured topics and
a data payload, emitted by a contract as it runs. A token contract emits
`transfer`; a DEX emits `swap`.

Events are how a UI reacts to contract state changes. The alternative is
polling contract storage on a timer, which is expensive, slow, and can only
tell you that a value differs from the last one you read — never *what
changed*. An event carries the transition itself.

## Basic usage

```tsx
import { useContractEvents } from "use-stellar"

function TransferFeed() {
  const { events, loading, error } = useContractEvents({
    contractIds: ["CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"],
  })

  if (loading && events.length === 0) return <p>Waiting for events...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {events.map(event => (
        <li key={event.id}>
          Ledger {event.ledger}: {JSON.stringify(event.value)}
        </li>
      ))}
    </ul>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `contractIds` | `string[]` | Yes | — | The contracts to watch. |
| `topics` | `string[][]` | No | — | Topic filter, per the RPC's matching rules. |
| `startLedger` | `number` | No | The RPC's latest ledger | Where to begin. Defaults to now, so a fresh subscription reports only what happens from here on. |
| `interval` | `number` | No | `5000` | Poll interval in ms. |
| `bufferSize` | `number` | No | `200` | Maximum events kept in memory. |
| `enabled` | `boolean` | No | `true` | When `false`, no request is issued and no timer runs. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `events` | `ContractEvent[]` | Events received so far, oldest first, bounded by `bufferSize`. |
| `latestLedger` | `number \| null` | The most recent ledger the RPC has seen. |
| `loading` | `boolean` | `true` while a poll is in flight. |
| `error` | `StellarError \| null` | The failure, or `null`. |
| `clear` | `() => void` | Empties the buffer without stopping the subscription. |

Each `ContractEvent`:

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | The event's unique id. |
| `contractId` | `string` | The contract that emitted it. |
| `ledger` | `number` | The ledger it was emitted in. |
| `ledgerClosedAt` | `string` | When that ledger closed, as an ISO timestamp. |
| `topics` | `unknown[]` | Topics decoded with `scValToNative`. |
| `value` | `unknown` | The payload decoded with `scValToNative`. |
| `raw` | `{ topics: string[]; value: string }` | The base64 XDR, always populated. |
| `decodeFailed` | `boolean \| undefined` | `true` when decoding failed and only `raw` is trustworthy. |

## It polls — there is no streaming

Horizon has server-sent events; the Soroban RPC does not. This hook polls
`getEvents` on an interval and advances a **cursor** between calls, so each poll
asks for what came after the last one rather than re-reading the same range.

That cursor is the whole trick. Polling from `startLedger` every time is the
most common bug in event subscriptions: every poll re-delivers every event you
have already seen.

Events are also de-duplicated by id, so a provider that replays an event at a
cursor boundary cannot deliver it to you twice.

## The retention window

RPC providers keep only a limited window of ledgers — typically around 24
hours. Asking for a `startLedger` older than that window is an **error**, not
an empty result:

```tsx
const { error } = useContractEvents({
  contractIds: [contractId],
  startLedger: 1, // long outside any retention window
})

if (error?.code === "LEDGER_OUT_OF_RETENTION") {
  // "The RPC server refused this ledger range: ... RPC providers retain a
  //  limited window of ledgers — typically around 24 hours. Request a more
  //  recent startLedger, or use an archival RPC provider for older history."
}
```

For history older than the window you need an archival RPC provider. This is a
property of the RPC you are pointed at, not of your query.

## The buffer is bounded

At most `bufferSize` events are kept (default 200). When the buffer is full,
**the oldest events are dropped** to make room for new ones.

This is deliberate: an event subscription on a busy contract would otherwise
grow without limit until the tab runs out of memory. If you need deeper
history, raise `bufferSize` — or persist events yourself as they arrive:

```tsx
import { useEffect, useRef } from "react"
import { useContractEvents } from "use-stellar"

function PersistingFeed({ contractId }: { contractId: string }) {
  const { events } = useContractEvents({ contractIds: [contractId] })
  const savedRef = useRef(new Set<string>())

  useEffect(() => {
    events
      .filter(event => !savedRef.current.has(event.id))
      .forEach(event => {
        savedRef.current.add(event.id)
        void saveToYourStore(event)
      })
  }, [events])

  return <p>{savedRef.current.size} events stored</p>
}
```

## Decoding can fail, and that is survivable

Event values are contract-defined. The SDK cannot decode a shape it does not
know, so a decode failure is a normal outcome rather than an exception.

When it happens, the event is still delivered: `raw` holds the base64 XDR and
`decodeFailed` is `true`. Nothing is thrown and nothing is dropped.

```tsx
{events.map(event =>
  event.decodeFailed ? (
    <li key={event.id}>Raw: {event.raw.value}</li>
  ) : (
    <li key={event.id}>{JSON.stringify(event.value)}</li>
  )
)}
```

## Examples

### Example 1 — filtering by topic

```tsx
import { useContractEvents } from "use-stellar"
import { nativeToScVal } from "@stellar/stellar-sdk"

function TransfersOnly({ contractId }: { contractId: string }) {
  const transferTopic = nativeToScVal("transfer", { type: "symbol" }).toXDR("base64")

  const { events } = useContractEvents({
    contractIds: [contractId],
    // "*" matches any value in that position.
    topics: [[transferTopic, "*", "*"]],
  })

  return <p>{events.length} transfers</p>
}
```

### Example 2 — watching several contracts, and pausing

```tsx
import { useState } from "react"
import { useContractEvents } from "use-stellar"

function MultiFeed() {
  const [watching, setWatching] = useState(true)

  const { events, latestLedger, clear } = useContractEvents({
    contractIds: [
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
      "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    ],
    interval: 10000,
    enabled: watching,
  })

  return (
    <div>
      <p>
        {events.length} events · ledger {latestLedger ?? "—"}
      </p>
      <button onClick={() => setWatching(w => !w)}>{watching ? "Pause" : "Resume"}</button>
      <button onClick={clear}>Clear</button>
    </div>
  )
}
```

### Example 3 — handling errors

```tsx
import { useContractEvents } from "use-stellar"

function FeedWithErrors({ contractId }: { contractId: string }) {
  const { events, error } = useContractEvents({ contractIds: [contractId] })

  if (error?.code === "LEDGER_OUT_OF_RETENTION") {
    return <p>That history is no longer available on this RPC server.</p>
  }

  if (error) {
    return <p>Could not read events: {error.message}</p>
  }

  return <p>{events.length} events</p>
}
```

## TypeScript

```ts
interface ContractEvent {
  id: string
  contractId: string
  ledger: number
  ledgerClosedAt: string
  topics: unknown[]
  value: unknown
  raw: { topics: string[]; value: string }
  decodeFailed?: boolean
}

interface UseContractEventsReturn {
  events: ContractEvent[]
  latestLedger: number | null
  loading: boolean
  error: StellarError | null
  clear: () => void
}
```

## Common errors

| Error code | Cause | Fix |
| :--- | :--- | :--- |
| `LEDGER_OUT_OF_RETENTION` | `startLedger` predates what the RPC retains. | Use a more recent ledger, or an archival RPC provider. |
| `NETWORK_ERROR` | The RPC server could not be reached. | Check `sorobanUrl` on your provider, and that a local node is running. |
| `VALIDATION_ERROR` | A contract id is malformed. | Contract ids are C-prefixed and 56 characters. |

## Notes

- `contractIds` and `topics` are compared by content, not identity, so inline
  array literals do not tear down and rebuild the subscription every render.
- Polling stops on unmount and whenever `enabled` is `false`.
- Out-of-order responses are discarded, so a slow poll cannot overwrite a
  newer one.
- `sorobanUrl` comes from your provider's `networkConfig`, and `http://` URLs
  are allowed so a local standalone node works without extra configuration.

## Related hooks

- [`useSorobanContract`](./use-soroban-contract.md) — read contract state directly.
- [`usePayments`](./use-payments.md) — the Horizon equivalent for classic payments.
