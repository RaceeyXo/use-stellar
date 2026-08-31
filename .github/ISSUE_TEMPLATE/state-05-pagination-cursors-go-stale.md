---
name: "State 05: Pagination cursors survive an address change"
about: fetchNext can page through the previous account's payments, mislabelled as the new account's
title: "fix(hooks): reset pagination cursors synchronously when the query changes"
labels: bug, hook
---

## Reset pagination cursors synchronously when the query changes

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days
**Depends on:** `state-04`

---

### Context

Horizon paginates with **opaque cursors**, and the SDK wraps them as `next()` /
`prev()` callbacks bound to the page they came from. `usePayments` and
`useTransactionHistory` store those callbacks in refs so the consumer can call
`fetchNext()` without knowing anything about cursors.

A cursor is only meaningful for the query that produced it. A cursor from account
A's payment stream is not a position in account B's — it is a position in a
different collection entirely.

---

### The defect

The refs are only replaced when a fetch **resolves**:

`packages/core/src/hooks/usePayments.ts:69-70`

```ts
nextRef.current = res.records.length > 0 ? () => res.next() : null
prevRef.current = res.records.length > 0 ? () => res.prev() : null
```

But `fetchNext` closes over a dependency list that does not include the cursor
state at all — `packages/core/src/hooks/usePayments.ts:102`:

```ts
}, [resolvedAddress, limit])
```

So between an address change and the new fetch landing, `nextRef.current` still
holds **account A's** `next()` callback, and `fetchNext()` happily calls it.

Then `packages/core/src/hooks/usePayments.ts:88` normalizes the resulting rows
against the **new** address:

```ts
const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress!))
```

`normalizePayment` decides direction by `to === address` (`usePayments.ts:163`).
Account A's payments compared against account B's address are **never** a match,
so every row is labelled `outgoing`.

The same shape exists in `useTransactionHistory.ts:59-60,71-90`, minus the
direction bug (transactions are not normalized against an address).

---

### Why this matters

The user sees account B's payments, attributed to account A, all mislabelled as
outgoing. Wrong data rendered with full confidence and no error is the worst
failure mode a financial UI has — it is strictly worse than showing nothing,
because the user has no reason to distrust it.

---

### Where this lives

- Hooks: `packages/core/src/hooks/usePayments.ts`,
  `packages/core/src/hooks/useTransactionHistory.ts`
- Tests: `packages/core/src/hooks/usePayments.test.tsx`,
  `packages/core/src/hooks/useTransactionHistory.test.ts`

---

### Implementation guidelines

- **Null both refs synchronously in the effect that reruns the query**, before the
  new fetch starts — not when the new fetch resolves. There must be no window in
  which a stale cursor is callable.
- The clean fix is to stop keeping cursor state in loose refs. Collapse
  `nextRef`, `prevRef`, `hasNext`, and `hasPrev` into a **single reducer state
  keyed by the query** (`{ queryKey, next, prev, hasNext, hasPrev }`), where
  `queryKey` is derived from `resolvedAddress`, `limit`, `order`, and `cursor`.
  Then:
  - `fetchNext` refuses to run when `state.queryKey !== currentQueryKey`
  - a resolved response is only committed when its `queryKey` still matches
  - the desync is unrepresentable rather than merely guarded against

  This is more work than nulling two refs, but the ref version has now produced
  three separate bugs (`state-04`, this one, `state-07`) and will produce more.

- **Never normalize a record against an address it did not come from.** Carry the
  address the request was made for alongside the response and normalize against
  _that_, not against the current `resolvedAddress`. Remove the `!` non-null
  assertions at `usePayments.ts:88` and `:110` — they are hiding exactly this
  problem.
- Land **`state-04`** first. Its race guard and this issue's query key are the same
  idea at different depths; building this on an unguarded fetch means writing the
  guard twice.
- Do both hooks in one PR.

---

### Acceptance criteria

- [ ] Change `address`, immediately call `fetchNext()` → **no request is made**
      against the old cursor
- [ ] Rows are never normalized against an address they did not come from
- [ ] The `!` non-null assertions at `usePayments.ts:88` and `:110` are gone
- [ ] `hasNext` / `hasPrev` cannot describe a page from a different query
- [ ] Changing `limit` or `order` resets pagination the same way `address` does
- [ ] Both hooks fixed; a regression test for the cross-account case in each
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

- Stale cursor writes: `packages/core/src/hooks/usePayments.ts:69-70,82-102`
- The mislabelling line: `packages/core/src/hooks/usePayments.ts:88`
- The direction logic it breaks: `packages/core/src/hooks/usePayments.ts:163`
- Sibling: `packages/core/src/hooks/useTransactionHistory.ts:59-60,71-90`
- Related: `state-04` (land first), `state-07` (`hasNext`), `state-08` (filtered pagination)
- Horizon pagination and cursors: https://developers.stellar.org/docs/data/apis/horizon/api-reference/structure/pagination

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
