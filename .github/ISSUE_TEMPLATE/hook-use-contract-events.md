---
name: "New hook: useContractEvents"
about: Subscribe to Soroban contract events so a UI can react to on-chain state changes
title: "feat(hook): useContractEvents — subscribe to Soroban contract events"
labels: enhancement, hook, soroban, help wanted
---

## New hook: `useContractEvents`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

Soroban contracts emit **events** — the on-chain equivalent of a log line, with
structured topics and a data payload. A token contract emits a `transfer` event;
a DEX contract emits a `swap`. This is how a UI reacts to contract state changes
without polling contract storage.

The RPC exposes `getEvents` with ledger-range and topic filters. Two things make
it different from Horizon streaming:

1. **It is poll-based, not streaming.** There is no SSE endpoint. You poll with a
   cursor and advance it.
2. **RPC providers retain only a limited ledger window** — typically around 24
   hours. Asking for a `startLedger` older than the retention window is an error,
   not an empty result.

This is the Soroban analogue of `hook-use-stream-payments`.

---

### Why this matters

Without events, a Soroban UI has to poll contract state on a timer to notice
anything changed — expensive, slow, and it cannot see _what_ changed, only that
the current value differs from the last one it read. Events carry the transition.

---

### Where this lives

- Hook: `packages/core/src/hooks/useContractEvents.ts`
- Test: `packages/core/src/hooks/useContractEvents.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Errors: `packages/core/src/errors/codes.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-contract-events.md`

---

### Suggested API

```ts
export interface ContractEvent {
  id: string
  contractId: string
  ledger: number
  ledgerClosedAt: string
  /** Decoded with scValToNative. */
  topics: unknown[]
  value: unknown
  /** Raw XDR, for consumers that need it. */
  raw: { topics: string[]; value: string }
}

export interface UseContractEventsOptions {
  contractIds: string[]
  /** Topic filter, per the RPC's matching rules. */
  topics?: string[][]
  startLedger?: number
  interval?: number
  bufferSize?: number
  enabled?: boolean
}

export interface UseContractEventsReturn {
  events: ContractEvent[]
  latestLedger: number | null
  loading: boolean
  error: StellarError | null
  clear: () => void
}
```

---

### Implementation guidelines

- **Advance the cursor correctly.** Each `getEvents` response carries a paging
  token; the next poll must start from it, not from `startLedger`. Getting this
  wrong produces duplicate events on every poll — the most common bug in event
  subscriptions and the reason the acceptance criteria call it out explicitly.
- **Handle the retention window as a specific error.** "Start ledger is older than
  the RPC's retention window" needs its own message telling the caller what
  happened and that they need an archival RPC or a smaller range. A generic
  failure here sends people to Discord. Coordinate with `core-05` on the code.
- **Decode with `scValToNative`, expose the raw XDR alongside.** Event values are
  contract-defined and decoding can fail — fall back to raw XDR rather than
  throwing, exactly as `useSorobanContract.ts:129-133` does for return values.
- **Bound the buffer** and document the drop behaviour, same as
  `hook-use-stream-payments`. An event subscription on a busy contract grows
  without limit otherwise.
- **Stop polling on unmount and when `enabled: false`.** Clear the interval in the
  effect cleanup — `useBalance.ts:93-98` shows the shape. `enabled: false` must
  issue no request at all.
- Use `networkConfig.sorobanUrl` from context, the way
  `useSorobanContract.ts:82-84` does, including the `allowHttp` handling for local
  nodes.
- `contractIds` is an **array prop** — an inline `contractIds={["C…"]}` literal is
  a new array every render. Key any dependency on a stable serialization, not the
  array identity. This is exactly `bug-01`'s failure mode; read that issue before
  writing the effect.
- Guard against out-of-order responses and unmount.

---

### Acceptance criteria

- [ ] Cursor advances correctly — **no duplicate events across polls**, proven by a
      test with two sequential poll responses
- [ ] "Start ledger outside retention window" is a distinct error with actionable guidance
- [ ] Events decoded with `scValToNative`, with raw XDR exposed alongside
- [ ] A decode failure falls back to raw XDR rather than throwing
- [ ] Polling stops on unmount and when `enabled: false`
- [ ] `enabled: false` issues no request
- [ ] Buffer is bounded and the drop behaviour is documented
- [ ] An inline `contractIds` array literal does not cause repeated re-subscription
- [ ] `sorobanUrl` comes from context, with `allowHttp` for local nodes
- [ ] Tests cover: cursor advancement, duplicate suppression, retention-window
      error, decode fallback, and cleanup
- [ ] `docs/hooks/use-contract-events.md` follows `docs/example.md`
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] Every example and test uses **testnet only** — no mainnet addresses
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- RPC config and `allowHttp`: `packages/core/src/hooks/useSorobanContract.ts:82-84`
- Decode fallback pattern: `packages/core/src/hooks/useSorobanContract.ts:129-133`
- Interval cleanup pattern: `packages/core/src/hooks/useBalance.ts:93-98`
- The array-identity trap: `bug-01`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `hook-use-stream-payments` (the Horizon analogue), `core-05`
- RPC `getEvents`: https://developers.stellar.org/docs/data/rpc/api-reference/methods/getEvents
- Contract events: https://developers.stellar.org/docs/learn/encyclopedia/contract-development/events

---

### Important rules — read before you start

- **Get assigned first.** Do not open a PR before you are assigned. Unassigned PRs
  are closed without review.
- **Target the `dev` branch.** Branch from `dev` and open your PR against `dev`.
  PRs opened against `main` will not be merged.
- **Make sure CI/CD passes.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` locally and confirm green before pushing.
- **Pull before you push.** `git pull --rebase origin dev` right before pushing.
- **Do not touch files outside your task.** Only the files under "Where this
  lives". Do not reformat, rename, or delete unrelated files.
- **Follow existing conventions** — match the surrounding hooks.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
