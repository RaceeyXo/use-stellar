# useContractEvents

Polls the Soroban RPC for events emitted by one or more contracts and keeps the latest ones in a bounded buffer.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { useContractEvents } from "@use-stellar/vue"
```

## Basic usage

Replace `CONTRACT_ID` with a contract deployed on testnet.

```vue
<script setup lang="ts">
import { useContractEvents } from "@use-stellar/vue"

const { events, loading, error } = useContractEvents({
  contractIds: ["CONTRACT_ID"],
})
</script>

<template>
  <p v-if="error">{{ error.message }}</p>
  <ul>
    <li v-for="event in events" :key="event.id">{{ event.contractId }} @ {{ event.ledger }}</li>
  </ul>
  <p v-if="loading">Polling...</p>
</template>
```

## Parameters

| Parameter     | Type                                                            | Required | Default       | Description                                                                           |
| ------------- | --------------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------- |
| `contractIds` | `MaybeRefOrGetter<readonly string[]>`                           | Yes      | -             | The contracts to watch. An empty list stops polling.                                  |
| `topics`      | `MaybeRefOrGetter<readonly (readonly string[])[] \| undefined>` | No       | none          | A topic filter, per the RPC's matching rules.                                         |
| `startLedger` | `MaybeRefOrGetter<number \| undefined>`                         | No       | Latest ledger | The ledger to start from. A ledger older than the RPC's retention window is an error. |
| `interval`    | `MaybeRefOrGetter<number \| undefined>`                         | No       | `5000`        | Milliseconds between polls. There is no streaming endpoint.                           |
| `bufferSize`  | `MaybeRefOrGetter<number \| undefined>`                         | No       | `200`         | The most events kept in memory. The oldest are dropped first.                         |
| `enabled`     | `MaybeRefOrGetter<boolean \| undefined>`                        | No       | `true`        | Set to `false` to stop polling and clear the buffer.                                  |

Changing any option stops the current poller and starts a new one.

## Return values

| Property       | Type                                | Description                                       |
| -------------- | ----------------------------------- | ------------------------------------------------- |
| `events`       | `ShallowRef<ContractEvent[]>`       | The buffered events.                              |
| `latestLedger` | `ComputedRef<number \| null>`       | The newest ledger the poller has seen, or `null`. |
| `loading`      | `ComputedRef<boolean>`              | `true` while a poll is in flight.                 |
| `error`        | `ComputedRef<StellarError \| null>` | The latest poll failure, or `null`.               |
| `clear`        | `() => void`                        | Empties the buffer without stopping the poller.   |

### `ContractEvent`

| Field            | Type                                  | Description                                           |
| ---------------- | ------------------------------------- | ----------------------------------------------------- |
| `id`             | `string`                              | The event ID.                                         |
| `contractId`     | `string`                              | The contract that emitted it.                         |
| `ledger`         | `number`                              | The ledger it was emitted in.                         |
| `ledgerClosedAt` | `string`                              | When that ledger closed.                              |
| `topics`         | `unknown[]`                           | The topics, decoded with `scValToNative`.             |
| `value`          | `unknown`                             | The data payload, decoded.                            |
| `raw`            | `{ topics: string[]; value: string }` | The undecoded XDR.                                    |
| `decodeFailed`   | `boolean \| undefined`                | `true` when the topics or value could not be decoded. |

## Examples

### Example 1 - the common case

```vue
<script setup lang="ts">
import { useContractEvents } from "@use-stellar/vue"

const { events } = useContractEvents({ contractIds: ["CONTRACT_ID"] })
</script>

<template>
  <output>{{ events.length }} events</output>
</template>
```

### Example 2 - reactive filters and a slower poll

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useContractEvents } from "@use-stellar/vue"

const watching = ref(true)
const { events, latestLedger, clear } = useContractEvents({
  contractIds: ["CONTRACT_ID"],
  interval: 15_000,
  bufferSize: 50,
  enabled: watching,
})
</script>

<template>
  <button type="button" @click="watching = !watching">{{ watching ? "Pause" : "Resume" }}</button>
  <button type="button" @click="clear">Clear</button>
  <p>Ledger {{ latestLedger ?? "-" }}, {{ events.length }} events</p>
</template>
```

### Example 3 - handling errors

A failed poll sets `error`. The poller keeps running, so a later poll can clear it.

```vue
<script setup lang="ts">
import { useContractEvents } from "@use-stellar/vue"

const { events, error } = useContractEvents({ contractIds: ["CONTRACT_ID"] })
</script>

<template>
  <p v-if="error">{{ error.code }}: {{ error.message }}</p>
  <ul>
    <li v-for="event in events" :key="event.id">{{ event.value }}</li>
  </ul>
</template>
```

## TypeScript

```ts
interface UseContractEventsOptions {
  contractIds: MaybeRefOrGetter<readonly string[]>
  topics?: MaybeRefOrGetter<readonly (readonly string[])[] | undefined>
  startLedger?: MaybeRefOrGetter<number | undefined>
  interval?: MaybeRefOrGetter<number | undefined>
  bufferSize?: MaybeRefOrGetter<number | undefined>
  enabled?: MaybeRefOrGetter<boolean | undefined>
}

interface UseContractEventsReturn {
  events: ShallowRef<ContractEvent[]>
  latestLedger: ComputedRef<number | null>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  clear: () => void
}
```

## Common errors

| Error code                | Cause                                                                | Fix                                                                          |
| ------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NETWORK_ERROR`           | The Soroban RPC is unreachable.                                      | Check the configured RPC URL. Polling continues on its own.                  |
| `LEDGER_OUT_OF_RETENTION` | `startLedger` is older than the RPC's retained window (about a day). | Start from a more recent ledger, omit `startLedger`, or use an archival RPC. |

## Notes

- The poller starts when the composable runs and stops when its effect scope is disposed, so call it during component setup.
- `events` is a `ShallowRef`: replace the array to update it, and do not mutate it in place.
- With no `startLedger`, a new subscription reports only what happens from now on.
- A poll that fails while the device is offline is not reported as an error, and one poll runs when connectivity returns.
- Events are polled, not streamed, so latency is up to `interval`.

## Differences from React

Vue accepts refs and getters for every option and ties the poller to the effect scope. React's hook takes plain values and ties it to the component lifecycle.

## Related hooks

- [React `useContractEvents`](../hooks/use-contract-events.md) - the equivalent React API.
- [`useSorobanContract`](./use-soroban-contract.md) - reads a contract's current state.
