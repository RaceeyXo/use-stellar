---
name: "React Native 39: Expose an awaiting-signature state in the write hooks"
about: During a mobile wallet hand-off the hooks only say loading; add a phase so UIs can show 'Approve in your wallet'.
title: "feat(core): expose the submission phase (building, awaiting signature, submitting) in write hooks"
labels: enhancement, react-native, framework-agnostic
---

## Expose an awaiting-signature state in the write hooks

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

`useSendPayment`, `useAddTrustline`, `usePathPayment` and `useSorobanWrite` expose one `loading` flag for the whole flow. On mobile the longest step by far is the user switching to the wallet app to approve.

---

### Why this matters

Users who see a spinner and no instruction often return to the app before approving, assume it is stuck, and retry, which can double-submit. A phase lets the UI say "Approve in LOBSTR".

---

### Where this lives

- `packages/core/src/actions/sendPayment.ts`, `addTrustline.ts`, `pathPayment.ts` (phase callback)
- the matching hooks in `packages/core/src/hooks/`
- their tests

---

### Implementation guidelines

- Add an optional `onPhase(phase)` to the action runtime; actions emit `building` → `signing` → `submitting` → `confirming`.
- Hooks expose `phase` alongside `loading`. Vue composables pick it up for free once they read the same actions.
- Additive change only — `loading` keeps its current meaning.

---

### Acceptance criteria

- [ ] Each write hook exposes `phase` with the four values in order
- [ ] A rejected signature ends in `idle` with the error set
- [ ] Existing tests pass unchanged
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

- `packages/core/src/actions/sendPayment.ts`
- `packages/core/src/hooks/useSendPayment.ts`

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
- **Follow existing conventions** — match the surrounding code.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
