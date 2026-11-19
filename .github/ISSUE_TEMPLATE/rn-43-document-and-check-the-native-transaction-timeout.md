---
name: "React Native 43: Document and check the native transaction timeout"
about: NATIVE_TRANSACTION_TIMEOUT is exported but undocumented; explain it and test the override.
title: "docs(react-native): document NATIVE_TRANSACTION_TIMEOUT and how to override it"
labels: enhancement, react-native, framework-agnostic, good first issue
---

## Document and check the native transaction timeout

**Complexity:** Low (50 points)
**Estimated time:** half a day

---

### Context

The native provider exports `NATIVE_TRANSACTION_TIMEOUT` and uses a longer default than the web 30 s, because the wallet hand-off is slow. The README does not say what the value is, why, or that `transactionTimeout` overrides it.

---

### Why this matters

Developers debugging `TX_TIMEOUT` on mobile need to know this exists.

---

### Where this lives

- `packages/react-native/README.md`
- `packages/react-native/src/StellarProvider.test.tsx`

---

### Implementation guidelines

- State the default value from the source, explain the reason, show the override.
- Add a test that an explicit `transactionTimeout` wins over the native default.

---

### Acceptance criteria

- [ ] README documents the default and override
- [ ] Test asserts the override
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

- `packages/react-native/src/StellarProvider.tsx`

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
