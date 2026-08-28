---
name: "State 07: hasNext strands users on an empty page"
about: A full final page reports hasNext, and clicking Next disables both buttons
title: "fix(hooks): hasNext heuristic strands users on an empty page"
labels: bug, hook, good first issue
---

## `hasNext` heuristic strands users on an empty page

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

Horizon returns a page of records plus a `_links` object containing `self`,
`next`, and `prev` URLs. The SDK wraps those as `next()` / `prev()` callbacks.
Horizon's own pagination is cursor-based and does not tell you a total count — but
the `_links.next` link is the authoritative signal for whether more records exist.

The history hooks do not use it. They guess from the record count.

---

### The defect

`packages/core/src/hooks/usePayments.ts:72` and
`packages/core/src/hooks/useTransactionHistory.ts:62`

```ts
setHasNext(res.records.length >= limit)
```

An account with **exactly** `limit` payments returns a full page and reports
`hasNext: true`. There is no next page.

The user clicks Next. `fetchNext` runs (`usePayments.ts:82-102`), Horizon returns
zero records, and then lines 91-92 fire:

```ts
nextRef.current = res.records.length > 0 ? () => res.next() : null
prevRef.current = res.records.length > 0 ? () => res.prev() : null
```

Both refs are nulled because `res.records.length` is `0`. The list is set to `[]`.
`fetchPrev` now returns immediately at line 105 (`if (!prevRef.current) return`).

The user is on an empty page with **Next and Prev both dead** and no way back. The
only recovery is a full remount.

---

### Why this matters

Every account whose payment count is an exact multiple of `limit` hits this — with
the default `limit = 10`, roughly one account in ten, and deterministically for any
account with exactly 10, 20, or 30 payments. Test accounts, which tend to have
small round numbers of transactions, hit it constantly.

The dead-end is worse than the wrong button state: the component's pagination is
permanently broken until it unmounts.

---

### Where this lives

- Hooks: `packages/core/src/hooks/usePayments.ts`,
  `packages/core/src/hooks/useTransactionHistory.ts`
- Tests: `packages/core/src/hooks/usePayments.test.tsx`,
  `packages/core/src/hooks/useTransactionHistory.test.ts`

---

### Implementation guidelines

- **Use Horizon's own signal.** The response carries `_links.next`; a page with no
  further records still has a `next` link, so check whether following it is
  meaningful rather than counting records. If the SDK's typings make `_links`
  awkward to reach, the alternative is to **fetch `limit + 1` records and slice** —
  request one more than you display, and `hasNext` is simply "did we get the extra
  one". That approach is self-evidently correct and needs no knowledge of Horizon's
  link semantics. Either is acceptable; say which you chose and why in the PR.
- **Never null the prev cursor on an empty page.** Landing on an empty result must
  leave `fetchPrev` callable. Split the two assignments at lines 91-92 (and 113-114,
  and the transaction-history equivalents) — `prevRef` should be replaced whenever
  the response provides a `prev`, independent of the record count.
- Consider whether an empty page should even replace the list. Arguably `fetchNext`
  landing on zero records should leave the current page rendered and simply set
  `hasNext: false`. That is a nicer UX and a smaller change than it looks. Your
  call — document the behaviour you pick in the hook's JSDoc.
- Fix `hasPrev` symmetrically. `usePayments.ts:117` has the same
  `res.records.length >= limit` heuristic on the prev path.
- Both hooks, one PR.

---

### Acceptance criteria

- [ ] An account with exactly `limit` payments reports `hasNext === false`
- [ ] An account with `limit + 1` payments reports `hasNext === true`
- [ ] Landing on an empty page still allows going back — `fetchPrev` works
- [ ] `hasPrev` no longer uses the record-count heuristic either
- [ ] The empty-page behaviour is documented in the hooks' JSDoc
- [ ] Both hooks fixed, with a regression test for the exact-multiple case in each
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

- The heuristic: `packages/core/src/hooks/usePayments.ts:72`,
  `packages/core/src/hooks/useTransactionHistory.ts:62`
- Where the cursors get nulled: `packages/core/src/hooks/usePayments.ts:91-92`
- Related: `state-04` (race guards), `state-05` (cursor staleness),
  `state-08` (filtered pagination, which compounds this)
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
