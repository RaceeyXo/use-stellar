---
name: "State 03: useTransaction has no race or unmount guard"
about: An older response can overwrite a newer one, and a ref is mutated during render
title: "fix(hooks): add race and unmount guards to useTransaction"
labels: bug, hook
---

## Add race and unmount guards to `useTransaction`

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Any hook that fetches asynchronously from a changeable input has to answer one
question: when two requests are in flight and they resolve out of order, which one
wins? The correct answer is always "the most recently _started_ one", never "the
most recently _resolved_ one".

`useBalance` answers it with a monotonic request id (`useBalance.ts:54-99`).
`useClaimableBalance` and `useFederationLookup` use the same pattern.
`useTransaction` has no guard of any kind.

---

### The defect

`packages/core/src/hooks/useTransaction.ts:43-80` — no `requestRef`, no cleanup
flag. Every `setTransaction`, `setError`, and `setLoading` after the `await` at
line 56 fires unconditionally:

```ts
try {
  const server = getHorizonServer(network)
  const raw = await server.transactions().transaction(hash).call()

  const status: TransactionStatus = raw.successful ? "success" : "failed"

  setTransaction({/* … */})
} catch (err: unknown) {
  // …
} finally {
  setLoading(false)
}
```

Change `hash` mid-flight and the older response overwrites the newer one. Unmount
mid-flight and `setLoading(false)` fires on a dead component.

The `useEffect` cleanup at lines 93-97 only clears the interval — it does nothing
about the in-flight request.

**Separately**, `packages/core/src/hooks/useTransaction.ts:41` mutates a ref
during render:

```ts
transactionRef.current = transaction
```

This is unsafe under StrictMode and concurrent rendering: React may render a
component without committing it, so the ref can be written with a value that never
reaches the screen. The ref exists to let the `watch` interval at lines 85-91 read
the latest status without re-creating the interval — a reasonable goal, wrong
mechanism.

---

### Why this matters

`useTransaction` is what a UI polls after submitting a payment. Racing two hashes
means showing the status of the _wrong transaction_ — reporting the previous
payment's success for the one the user just sent.

The render-phase ref write is the kind of bug that passes every test today and
breaks the moment the consumer app enables StrictMode or React's concurrent
features.

---

### Where this lives

- Hook: `packages/core/src/hooks/useTransaction.ts`
- Test: `packages/core/src/hooks/useTransaction.test.ts`

---

### Implementation guidelines

- **Adopt the `requestRef` pattern** already used at `useBalance.ts:54-99`:
  increment on entry, compare before every `setState` after an `await`. Read
  **`state-01`** first — it fixes a real flaw in that pattern's cleanup handling,
  and you should copy the corrected version, not the current one.
- **Move the ref write into an effect:**

  ```ts
  useEffect(() => {
    transactionRef.current = transaction
  }, [transaction])
  ```

  Refs may be written in effects and event handlers, never during render.

- Add a cancellation flag to the existing cleanup at lines 93-97 so an in-flight
  request cannot update state after unmount. The cleanup already runs on every
  `[fetchTransaction, watch]` change, so reset the flag at the top of the effect.
- Keep the `watch` polling behaviour intact — it stops polling once the status is
  terminal (`useTransaction.ts:87-88`), which is correct and must survive.
- Keep the 404 handling at lines 70-72 as-is. A 404 means "not yet in a ledger",
  and treating it as `pending` under `watch` is deliberate.
- **This issue is the template for `state-04`.** Write the guard cleanly enough
  that the next contributor can copy it verbatim into `usePayments` and
  `useTransactionHistory`.

---

### Acceptance criteria

- [ ] Two `hash` changes in flight, slow response first → the **newer** result wins
- [ ] Unmount mid-flight produces no state update
- [ ] No ref mutation during render anywhere in the file
- [ ] `watch` polling still stops on a terminal status
- [ ] 404-as-pending behaviour unchanged
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

- The unguarded hook: `packages/core/src/hooks/useTransaction.ts:41,43-80`
- The pattern to copy: `packages/core/src/hooks/useBalance.ts:54-99`
- The pattern's own bug, fix first: `state-01`
- Downstream: `state-04` copies this guard into the history hooks
- React: refs must not be written during render —
  https://react.dev/reference/react/useRef#caveats

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
