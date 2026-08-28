---
name: "New hook: useStreamPayments"
about: Live payment stream over Horizon SSE so a UI can react the moment money arrives
title: "feat(hook): useStreamPayments — live payment stream via Horizon SSE"
labels: enhancement, hook, help wanted
---

## New hook: `useStreamPayments`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days
**Depends on:** `state-06` (shared normalizer)

---

### Context

Horizon exposes **Server-Sent Events** on every collection endpoint. Instead of
`.call()`, you use `.stream({ onmessage, onerror })` and Horizon holds the
connection open, pushing each new record as it lands. The call returns a **close
function** that must be invoked to tear the connection down.

Today the only way to notice a new payment in `use-stellar` is `watch: true`
polling on `useBalance` — a full account reload every 10 seconds
(`useBalance.ts:9`), which is both slower to react and much heavier on the
endpoint than a single open connection.

"Did the money arrive yet?" is the single most requested primitive for wallet and
merchant UIs, and it is what SSE exists for.

---

### Why this matters

A merchant checkout page polling every 10 seconds shows a payment up to 10 seconds
after it settles, and issues 360 requests an hour per open tab to do it. A stream
shows it within a ledger close (~5s) on one connection.

Without this hook, every consumer builds their own SSE handling against the raw
SDK — reconnection, cursor resumption, buffer bounds and all — which is exactly the
Stellar-specific plumbing this library exists to absorb.

---

### Where this lives

- Hook: `packages/core/src/hooks/useStreamPayments.ts`
- Test: `packages/core/src/hooks/useStreamPayments.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-stream-payments.md`

---

### Suggested API

```ts
export interface UseStreamPaymentsOptions {
  /** Defaults to the connected wallet address. */
  address?: string
  /** `"now"` streams only future payments; a cursor resumes from that point. */
  cursor?: string | "now"
  /** Maximum records held in memory. Defaults documented in the JSDoc. */
  bufferSize?: number
  enabled?: boolean
}

export interface UseStreamPaymentsReturn {
  /** Newest first, bounded by `bufferSize`. */
  payments: NormalizedPayment[]
  connected: boolean
  error: StellarError | null
  /** Last cursor seen, so a caller can persist and resume across sessions. */
  cursor: string | null
  reconnect: () => void
  clear: () => void
}
```

---

### Implementation guidelines

- **Reuse `normalizePayment`** from `packages/core/src/hooks/usePayments.ts:143-211`.
  It is currently module-private — extract it to a shared module as part of this
  work rather than copying it. **Land `state-06` first**, or the stream inherits
  its blank-0-XLM-row bug for every Soroban transfer.
- **The close function is not optional.** `.stream()` returns it; call it in the
  effect cleanup. A leaked SSE connection survives navigation and keeps consuming
  a browser connection slot — browsers cap concurrent connections per origin, so a
  few leaks and the whole app stops making requests.
- **Reconnect with backoff and cursor resumption.** Track the last seen paging
  token; on reconnect, resume from it so a dropped connection does not lose events.
  Without this, a 30-second network blip silently drops every payment in the gap —
  the worst possible failure for a "did it arrive" UI. Use jittered exponential
  backoff (coordinate with `core-08`'s helper if it has landed).
- **Bound the buffer.** An open stream on a busy account grows without limit
  otherwise. Default to something modest, make it configurable, and document that
  older records are dropped — this hook is a live tail, not a history API. Point
  users at `usePayments` for history.
- `enabled: false` must open **no connection at all**, and flipping it to `false`
  must close an open one.
- `cursor: "now"` is Horizon's own sentinel for "only future records" — pass it
  through rather than reinventing it.
- SSE is browser-only. Guard with `isBrowser()` from `../utils` the way the other
  hooks do, and make the SSR path a no-op rather than a throw.
- Errors go through `toStellarError`. A deliberate close during cleanup must **not**
  set `error` — same rule as `core-02`'s abort handling.

---

### Acceptance criteria

- [ ] Stream closes on unmount — the test asserts the SDK's close function was called
- [ ] Reconnects with jittered backoff and resumes from the last seen cursor
- [ ] A simulated disconnect/reconnect loses no events
- [ ] `enabled: false` opens no connection; flipping to `false` closes an open one
- [ ] Buffer is bounded, configurable, and the drop behaviour is documented
- [ ] `cursor: "now"` yields only payments that arrive after mount
- [ ] Soroban (`invoke_host_function`) records normalize correctly, not as blank rows
- [ ] `normalizePayment` is shared with `usePayments`, not copy-pasted
- [ ] SSR render is a no-op, not a throw
- [ ] A deliberate close does not set `error`
- [ ] `docs/hooks/use-stream-payments.md` follows `docs/example.md`
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

- The normalizer to share: `packages/core/src/hooks/usePayments.ts:143-211`
- Cleanup patterns to copy: `packages/core/src/hooks/useBalance.ts:93-98`
- Error codes: `packages/core/src/errors/codes.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `state-06` (land first), `core-08` (backoff helper),
  `hook-use-contract-events` (the Soroban analogue)
- Horizon streaming: https://developers.stellar.org/docs/data/apis/horizon/api-reference/structure/streaming

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
