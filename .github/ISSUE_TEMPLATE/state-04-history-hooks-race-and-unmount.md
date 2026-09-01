---
name: "State 04: History hooks have no race or unmount guard"
about: Switching accounts can leave one account's payment list rendered under another's header
title: "fix(hooks): add race and unmount guards to usePayments and useTransactionHistory"
labels: bug, hook
---

## Add race and unmount guards to `usePayments` and `useTransactionHistory`

**Complexity:** Medium (150 points)
**Estimated time:** 1 day
**Depends on:** `state-03` (same pattern — copy the guard it lands)

---

### Context

Both history hooks fetch a page of records for an address, then normalize and
store them. Neither guards the state write that happens after the `await`, so the
result of whichever request finishes last wins — regardless of which started last.

Horizon response times vary widely by account size, so "older request, slower
response" is common, not a corner case: a large account's page takes noticeably
longer than a small one's.

---

### The defect

`packages/core/src/hooks/usePayments.ts:46-80`

```ts
const res = await query.call()
const normalized = res.records.map(rec => normalizePayment(rec, resolvedAddress))
setPayments(normalized) // ← unguarded

nextRef.current = res.records.length > 0 ? () => res.next() : null
prevRef.current = res.records.length > 0 ? () => res.prev() : null

setHasNext(res.records.length >= limit)
setHasPrev(!!cursor)
```

`packages/core/src/hooks/useTransactionHistory.ts:36-69` is structurally identical
(`setTransactions` at line 56).

Neither hook has a `requestRef`, and neither `useEffect` returns a cleanup
function at all (`usePayments.ts:126-128`,
`useTransactionHistory.ts:113-115`) — so there is nothing to cancel against on
unmount either.

The pagination callbacks are unguarded too: `fetchNext` and `fetchPrev` write
`nextRef` / `prevRef` after their own awaits, which is how `state-05` becomes
possible.

---

### Why this matters

In an account-switcher UI — a wallet with several addresses, an admin tool, a
block explorer — clicking quickly through accounts leaves the **loser's** payment
list rendered under the **winner's** header. The user is looking at someone else's
transaction history, with no indication anything is wrong.

Combined with `state-05`, the rows are also mislabelled `incoming`/`outgoing`
against the wrong address, which turns a display bug into a wrong-data bug.

---

### Where this lives

- Hooks: `packages/core/src/hooks/usePayments.ts`,
  `packages/core/src/hooks/useTransactionHistory.ts`
- Tests: `packages/core/src/hooks/usePayments.test.tsx`,
  `packages/core/src/hooks/useTransactionHistory.test.ts`

---

### Implementation guidelines

- Copy the guard `state-03` lands — do not invent a second variant. Three different
  race-guard implementations in one codebase is worse than one imperfect one.
- **Guard all three fetchers**, not just the initial one. `fetchPayments`,
  `fetchNext`, and `fetchPrev` all write state after an `await`, and all three need
  the same treatment. The same goes for the transaction-history trio.
- Add a cleanup to both `useEffect`s. They currently return nothing.
- **The cursor refs need the same protection.** `nextRef.current` / `prevRef.current`
  are written after every await; a superseded response must not install its
  pagination callbacks over a newer page's. Guard those writes with the same check
  as the `setState` calls. (The deeper cursor-staleness problem — cursors surviving
  an address change — is **`state-05`**, not this issue. Fix the race here; leave
  the synchronous reset to that PR.)
- `useTransactionHistory`'s error path already preserves data on failure
  (`useTransactionHistory.ts:64-65`); `usePayments`'s does not
  (`usePayments.ts:74-77`). That difference is **`state-02`**'s territory — do not
  change either one here.
- Do both hooks in one PR. They are structurally identical and splitting them
  guarantees the two guards drift.

---

### Acceptance criteria

- [ ] Both hooks guarded; a test for out-of-order resolution in each
- [ ] `fetchNext` and `fetchPrev` are guarded too, not just the initial fetch
- [ ] A superseded response cannot install its `nextRef` / `prevRef` callbacks
- [ ] Unmount mid-flight produces no state update in either hook
- [ ] Both `useEffect`s return a cleanup function
- [ ] The guard implementation matches `state-03`'s
- [ ] Every test passes under `<React.StrictMode>` double-rendering
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

- Unguarded fetches: `packages/core/src/hooks/usePayments.ts:46-80`,
  `packages/core/src/hooks/useTransactionHistory.ts:36-69`
- The guard to copy: whatever `state-03` lands in `useTransaction.ts`
- Related: `state-05` (cursor staleness), `state-06` (normalization gaps),
  `state-07` (`hasNext` heuristic) — all in these same two files
- Horizon pagination: https://developers.stellar.org/docs/data/apis/horizon/api-reference/structure/pagination

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
