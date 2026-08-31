---
name: "State 01: useBalance can hang on loading forever"
about: Two paths leave the loading spinner up permanently in useBalance and useClaimableBalance
title: "fix(hooks): useBalance can hang on loading: true forever"
labels: bug, hook, good first issue
---

## `useBalance` can hang on `loading: true` forever

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

`useBalance` uses a monotonic request id to ignore stale responses — a standard
pattern. `requestRef.current` is incremented at the start of each fetch, and any
response whose id no longer matches the current one is discarded because a newer
fetch has superseded it.

The cleanup function then sets `requestRef.current = -1` to mark the hook as
cancelled, so nothing can update state after unmount.

The two mechanisms are correct on their own and wrong together, because the code
uses the _same_ check for "superseded" and "cancelled".

---

### The defect

`packages/core/src/hooks/useBalance.ts:58-99`

```ts
const fetchBalances = useCallback(async () => {
  if (!resolvedAddress) return // ← line 59: returns without clearing loading

  const fetchId = ++requestRef.current
  setLoading(true)
  setError(null)

  try {
    // …
  } catch (err) {
    // …
  } finally {
    if (fetchId === requestRef.current) {
      // ← line 80: false after cleanup
      setLoading(false)
    }
  }
}, [resolvedAddress, network])

useEffect(() => {
  fetchBalances()
  // …
  return () => {
    if (id) clearInterval(id)
    requestRef.current = -1 // ← line 97
  }
}, [fetchBalances, watch, interval])
```

Two paths leave the spinner up forever:

1. **Line 59.** The early return fires when there is no address — no `address`
   prop and no connected wallet. `loading` keeps whatever value it had.
2. **Lines 80 + 97.** The cleanup sets `requestRef.current = -1`, so any in-flight
   fetch's `finally` guard fails and `setLoading(false)` is skipped. Disconnect the
   wallet mid-fetch, or change the address mid-fetch, and the effect re-runs, the
   old fetch's guard fails, and the spinner never stops.

The same shape exists in `packages/core/src/hooks/useClaimableBalance.ts:32-36`,
where the early return clears `balances` but not `loading`.

---

### Why this matters

A permanently-spinning balance is the first thing a user sees in the most common
consumer of this library. There is no error, no retry affordance, and no way for
the app to tell the difference between "still loading" and "stuck".

The wallet-disconnect case is not exotic — it is what happens every time a user
signs out.

---

### Where this lives

- Hooks: `packages/core/src/hooks/useBalance.ts`,
  `packages/core/src/hooks/useClaimableBalance.ts`
- Tests: `packages/core/src/hooks/useBalance.test.ts`,
  `packages/core/src/hooks/useBalance.test.tsx`,
  `packages/core/src/hooks/useClaimableBalance.test.ts`

---

### Implementation guidelines

- **Clear `loading` on the early-return path.** When there is no address there is
  nothing to load, so `loading` must be `false` and `balances` should be reset.
  `useClaimableBalance.ts:33-36` already resets `balances` — add the `setLoading(false)`
  there too.
- **Separate "cancelled" from "superseded".** They need different handling:
  - _Superseded_ (a newer fetch started): discard the response, but the newer
    fetch owns `loading` — correct to skip `setLoading(false)`.
  - _Cancelled_ (unmounted): skip **all** state updates, including `setLoading`.
    React 18 no longer warns about setState-after-unmount, but it is still wrong.
  - _Neither_: settle normally.

  The simplest correct shape is a separate `cancelledRef` boolean set only by the
  cleanup, with `requestRef` left to do only its supersession job. Then the
  `finally` becomes: if cancelled, do nothing; else if superseded, do nothing; else
  `setLoading(false)`.

- Do **not** just delete the `finally` guard — that reintroduces the stale-response
  bug the guard exists to prevent.
- Watch the interaction with `watch: true`. The effect re-runs on every `interval`
  or `watch` change and the cleanup fires each time, so a "cancelled" flag must be
  **reset** when the effect re-runs, not left permanently true.
- Leave the `catch` block's data-clearing alone — that is **`state-02`**'s job. Do
  not fix both in one PR; they will conflict.

---

### Acceptance criteria

- [ ] Rendering with no `address` and no connected wallet leaves `loading === false`
- [ ] Start a fetch, unmount mid-flight → no state update, no warning
- [ ] Start a fetch, change `address` mid-flight → `loading` settles to `false` and
      the newer result wins
- [ ] Start a fetch, disconnect the wallet mid-flight → `loading` settles to `false`
- [ ] `watch: true` still polls correctly across re-renders after the fix
- [ ] The same fix applied to `useClaimableBalance`
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

- The defect: `packages/core/src/hooks/useBalance.ts:58-99`
- The sibling: `packages/core/src/hooks/useClaimableBalance.ts:32-36`
- Related: `state-02` (the same hook's error path), `state-03` (the same pattern
  applied to `useTransaction`), `core-02` (proper `AbortSignal` cancellation)
- Existing unmount tests to model on: `packages/core/src/hooks/useBalance.test.ts`

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
