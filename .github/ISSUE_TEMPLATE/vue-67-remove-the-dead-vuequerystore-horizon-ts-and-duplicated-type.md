---
name: "Vue 67: Remove the dead VueQueryStore, horizon.ts and duplicated types"
about: store.ts, horizon.ts and parts of types.ts predate the move to use-stellar/core and are now unused duplicates.
title: "refactor(vue): remove the unused VueQueryStore, horizon helpers and duplicated types"
labels: enhancement, vue, framework-agnostic, refactor
---

## Remove the dead VueQueryStore, horizon.ts and duplicated types

**Complexity:** Medium (100 points)
**Estimated time:** 1 day

---

### Context

Three files in `packages/vue/src` are left over from before the package was rebuilt on `use-stellar/core`:

- `store.ts` — `VueQueryStore`, a second cache implementation. It is exported from the package index but **no composable uses it**; they all use the core `QueryStore` on `runtime.queryStore`.
- `horizon.ts` — its own Horizon helpers and an `AdapterError` with a smaller error-code set. Its header comment says it exists to avoid importing React, which `use-stellar/core` already solves. Only a test imports it.
- `types.ts` — re-declares network and asset types that core exports.

---

### Why this matters

A second cache class in the public API invites users to create one and wonder why composables ignore it. A second error type with different codes contradicts the README's promise that error codes match React. Dead code also counts against the bundle budget.

---

### Where this lives

- `packages/vue/src/store.ts` (delete)
- `packages/vue/src/horizon.ts` (delete)
- `packages/vue/src/types.ts`
- `packages/vue/src/index.ts`
- `packages/vue/src/__tests__/vue.contract.test.ts`
- `CHANGELOG.md`

---

### Implementation guidelines

- Confirm with a grep that nothing outside tests imports `store.ts` or `horizon.ts` before deleting.
- Replace `types.ts` declarations with re-exports from `use-stellar/core` so existing type imports from `@use-stellar/vue` keep working.
- Removing `VueQueryStore` from the index is a breaking change to the published 0.2.3 API: note it in `CHANGELOG.md` Unreleased.
- Point the contract test at core's error classification instead of `horizon.ts`.

---

### Acceptance criteria

- [ ] `store.ts` and `horizon.ts` are gone
- [ ] Every type `@use-stellar/vue` exported before is still exported (now from core)
- [ ] The Vue bundle size goes down (`pnpm --filter @use-stellar/vue size`)
- [ ] CHANGELOG notes the removal
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

- `packages/vue/src/store.ts`, `packages/vue/src/horizon.ts`
- `packages/vue/src/plugin.ts` (uses core `QueryStore`)

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
