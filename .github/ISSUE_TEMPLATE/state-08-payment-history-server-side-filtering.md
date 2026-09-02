---
name: "State 08: usePaymentHistory filters client-side and breaks pagination"
about: Filtering the current page only returns 0-10 arbitrary rows and can permanently disable paging
title: "fix(hooks): usePaymentHistory filters client-side and breaks pagination"
labels: bug, hook
---

## `usePaymentHistory` filters client-side and breaks pagination

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

`usePaymentHistory` wraps `usePayments` and adds two filters: by `direction`
(`incoming` / `outgoing` / `all`) and by `asset`. It is the hook a consumer reaches
for when building "show me my USDC receipts".

The filters run **after** pagination, on whatever the current page happens to
contain. That inverts the relationship: the page size stops meaning "how many rows
you get" and starts meaning "how many rows we searched".

---

### The defect

`packages/core/src/hooks/usePaymentHistory.ts:25-53`

```ts
const filteredPayments = useMemo(() => {
  let newFilteredPayments = rawPayments

  if (direction !== "all") {
    newFilteredPayments = newFilteredPayments.filter(p => p.direction === direction)
  }

  if (asset !== "all") {
    newFilteredPayments = newFilteredPayments.filter(p => {
      /* … */
    })
  }

  return newFilteredPayments
}, [rawPayments, direction, asset])

const hasNext = filteredPayments.length > 0 && hasNextPage
```

Three distinct problems:

**1. Arbitrary result counts.** `limit: 10` with `direction: "incoming"` returns
between 0 and 10 rows depending on what the underlying page held. The caller asked
for 10.

**2. `hasNext` gates on match count (line 53).** A page with zero matches sets
`hasNext = false`, **permanently disabling paging**. The user can never reach later
pages that do match. The comment above it (lines 49-52) explains this was
deliberate — it is trading one bad behaviour for a worse one.

**3. `asset` is an object in a dependency array (line 47).** An inline
`asset={{ code, issuer }}` prop makes `filteredPayments` a new array identity on
every render, so any consumer with `useEffect(…, [payments])` loops. Same class of
bug as `bug-01`.

---

### Why this matters

The pagination is unusable as written: the user either gets an unpredictable
number of rows or gets stuck. And this hook has **zero tests** — it is the only
exported hook with no test file at all (see `test-05`), so none of this was ever
going to be caught.

---

### Where this lives

- Hook: `packages/core/src/hooks/usePaymentHistory.ts`
- Underlying hook: `packages/core/src/hooks/usePayments.ts`
- Types: `packages/core/src/types/index.ts` (`UsePaymentHistoryOptions`)
- Test: `packages/core/src/hooks/usePaymentHistory.test.tsx` (**create**)

---

### Implementation guidelines

- **Push filters into the Horizon query where the API supports it.** Horizon's
  `/payments` endpoint does not filter by direction or asset, so most of this has
  to be client-side — but check the current API before assuming. Where Horizon can
  do it, let it.
- **Where it cannot, accumulate.** Keep fetching pages until you have `limit`
  matches or the cursor is exhausted. That means this hook owns its own paging
  loop rather than passing `usePayments`'s cursors straight through. Bound the
  number of underlying requests per `fetchNext()` call and **expose when you hit
  that bound**, so a consumer filtering for a rare asset gets "no more matches
  found in N pages" rather than a silent stop.
- **`hasNext` must never depend on the match count.** It describes whether more
  _source_ records exist. Delete line 53's `filteredPayments.length > 0 &&`.
- **Memoize on primitives.** Depend on `asset === "all" ? "all" : asset.code` and
  `asset.issuer`, not the object. Same for anything else object-shaped in the
  dependency list.
- Land **`state-05`** and **`state-07`** first if you can — this hook inherits its
  cursor behaviour from `usePayments`, and building an accumulating pager on top of
  cursors that go stale is wasted work.
- **Write the test file.** It does not exist. Cover: direction filter, asset filter,
  both together, a page with zero matches, the accumulation bound, and identity
  stability across re-renders with an inline `asset` prop.

---

### Acceptance criteria

- [ ] `limit: 10` with a filter returns 10 matching rows when 10 exist anywhere in
      the history
- [ ] A page with zero matches does **not** disable `hasNext`
- [ ] Hitting the per-call request bound is observable to the consumer, not silent
- [ ] Inline object props do not change the `payments` array identity across renders
- [ ] `usePaymentHistory.test.tsx` created, covering direction filter, asset filter,
      the zero-match page, the request bound, and identity stability
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

- The hook: `packages/core/src/hooks/usePaymentHistory.ts:25-53`
- The object dependency: `packages/core/src/hooks/usePaymentHistory.ts:47`
- The `hasNext` gate: `packages/core/src/hooks/usePaymentHistory.ts:53`
- Related: `state-05` and `state-07` (land first), `test-05` (this hook's missing coverage)
- Horizon `/payments` parameters: https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-payments-by-account-id

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
