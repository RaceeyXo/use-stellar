---
name: "Vue 74: Extend the React–Vue parity tests to every composable"
about: The parity contract test should fail when a React hook and its Vue composable disagree on keys, errors or results.
title: "test(vue): assert React and Vue parity for every composable pair"
labels: enhancement, vue, framework-agnostic, testing
---

## Extend the React–Vue parity tests to every composable

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

`packages/vue/src/__tests__/vue.contract.test.ts` checks a subset of behaviour. As this wave adds ~20 composables, nothing guarantees each one uses the same query key and error codes as its React twin.

---

### Why this matters

Parity is the package's core promise ("behaviour and error codes are identical"). A table-driven test turns that promise into a check that runs on every PR.

---

### Where this lives

- `packages/vue/src/__tests__/vue.contract.test.ts`
- New: `packages/vue/src/__tests__/parity.table.ts`

---

### Implementation guidelines

- A table of `{ react: useX, vue: useX, args, mockResponses }`; for each row run both against the same mocked SDK and compare the request made, the query key, the mapped data and the error `code` for 404/429/500.
- Fail the test when a composable is exported from `@use-stellar/vue` without a table row.

---

### Acceptance criteria

- [ ] Every Vue composable has a parity row
- [ ] Adding a composable without a row fails the test
- [ ] Runs in the normal `pnpm test`
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

- `packages/vue/src/__tests__/vue.contract.test.ts`

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
