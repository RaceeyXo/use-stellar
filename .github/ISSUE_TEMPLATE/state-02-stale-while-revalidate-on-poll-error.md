---
name: "State 02: A poll error wipes good balance data"
about: One failed poll blanks the whole balance display instead of keeping the last good value
title: "fix(hooks): a transient poll error should not wipe good balance data"
labels: bug, hook
---

## A transient poll error should not wipe good data

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

`useBalance({ watch: true })` re-fetches on an interval — 10 seconds by default
(`useBalance.ts:9`). It polls public Horizon, which rate-limits aggressively, and
the library has no request deduplication (`core-01`) and no backoff (`core-08`).
So transient failures are not hypothetical; they are the expected steady state for
any dashboard with more than one hook mounted.

Every serious data-fetching library answers this with **stale-while-revalidate**:
when a refresh fails, keep showing the last known-good data and surface the error
alongside it. The data is stale, not wrong, and the user is better served seeing a
slightly old balance with a warning than seeing nothing.

---

### The defect

`packages/core/src/hooks/useBalance.ts:74-78`

```ts
} catch (err) {
  if (fetchId !== requestRef.current) return
  setBalances([])
  setLastUpdated(null)
  setError(toStellarError(err))
}
```

A failed fetch destroys **both** the data and the `lastUpdated` timestamp that
would have told the consumer the data was merely stale.

The same pattern appears in:

- `packages/core/src/hooks/usePayments.ts:74-77` — `setPayments([])` on error
- `packages/core/src/hooks/useClaimableBalance.ts:60-69` — `setBalances([])` on both branches
- `packages/core/src/hooks/useAsset.ts:85-87` — sets `error` **without** clearing
  `asset`, which is the opposite bug (see `core-05`)

`useTransactionHistory.ts:64-65` gets it right by accident — it sets `error` and
leaves `transactions` alone.

---

### Why this matters

A single 429 from Horizon blanks the user's entire balance display. Ten seconds
later the next poll succeeds and it flickers back. On a rate-limited endpoint the
balance strobes between real and empty for as long as the page is open.

Destroying `lastUpdated` is the subtler half: it removes the only signal a
consumer could use to render "as of 30 seconds ago" instead of "nothing here".

---

### Where this lives

- Hooks: `packages/core/src/hooks/useBalance.ts`,
  `packages/core/src/hooks/useAccount.ts`,
  `packages/core/src/hooks/usePayments.ts`,
  `packages/core/src/hooks/useClaimableBalance.ts`
- Types: `packages/core/src/types/index.ts`
- Tests: the corresponding `*.test.ts` / `*.test.tsx` files
- Docs: `docs/hooks/use-balance.md`

---

### Implementation guidelines

- **The rule:** clear data only when the *query* changes. Never when a fetch fails.
  - `address` changes → clear immediately, the old data is about a different account
  - fetch fails → keep data, set `error`, leave `lastUpdated` at the last
    **successful** fetch
  - fetch succeeds → replace data, clear `error`, bump `lastUpdated`
- Expose staleness so consumers can render it. Either add an explicit `isStale:
  boolean` to the return type, or document that `error !== null && balances.length > 0`
  means "stale data shown". Prefer the explicit flag — it is self-documenting and
  cheap. Whichever you choose, do it consistently across all four hooks.
- Clearing on query change must happen **synchronously in the effect**, not when
  the new fetch resolves, or there is a window where account A's balance renders
  under account B's header. This is the same class of bug as `state-05`.
- Do **not** change the `loading` semantics — that is **`state-01`**'s job, and the
  two PRs will conflict in the same `catch`/`finally` block. Coordinate: land
  `state-01` first, then rebase this on top.
- `useAsset`'s inverse bug (setting `error` without clearing `asset` when the
  *query* changed to an invalid asset) is scoped to **`core-05`**. Leave it.
- Update `docs/hooks/use-balance.md` and the hook's JSDoc to state the
  stale-while-revalidate contract explicitly. This is a behaviour change consumers
  need to know about — add a `CHANGELOG.md` entry.

---

### Acceptance criteria

- [ ] After a successful fetch followed by a failing poll, `balances` still holds
      the last good value **and** `error` is set
- [ ] `lastUpdated` still reflects the last **successful** fetch, not the failure
- [ ] Changing `address` clears `balances` immediately, before the new fetch resolves
- [ ] A subsequent successful poll clears `error` and refreshes the data
- [ ] Staleness is observable by the consumer (explicit flag or documented contract)
- [ ] The same rule applied to `useAccount`, `usePayments`, and `useClaimableBalance`
- [ ] Documented in the hooks' JSDoc, in `docs/hooks/use-balance.md`, and in `CHANGELOG.md`
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

- The defect: `packages/core/src/hooks/useBalance.ts:74-78`
- The default poll interval: `packages/core/src/hooks/useBalance.ts:9`
- A hook that already keeps data on error: `packages/core/src/hooks/useTransactionHistory.ts:64-65`
- Related: `state-01` (same block, land first), `core-08` (rate-limit backoff),
  `core-01` (caching, which makes this rarer)
- Stale-while-revalidate as a contract: https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators

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
