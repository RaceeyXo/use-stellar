---
name: "Vue 42: Wire the Vue package into CI and pre-push checks"
about: Run format, lint, typecheck, tests, build, and size checks for packages/vue in CI and the husky pre-push hook.
title: "ci(vue): run quality, test, build, and size checks for @use-stellar/vue"
labels: enhancement, vue, framework-agnostic, ci
---

## Wire the Vue package into CI and pre-push checks

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-10`

---

### Context

Root scripts and `.github/workflows/ci.yml` only target `packages/core` and the
Next.js demo: `pnpm lint`, `pnpm typecheck`, and `pnpm test` all filter to
`use-stellar`. The Vue package can break without CI noticing.

---

### Why this matters

An adapter that is not tested in CI regresses silently when core changes.
Because Vue depends on core internals via `use-stellar/core`, core PRs must run
Vue checks too.

---

### Where this lives

- Update: root `package.json` scripts (`lint`, `typecheck`, `test`, `format:check`, `size`)
- Update: `.github/workflows/ci.yml`
- Update: `.husky/pre-push`
- Update: `.eslintrc.json` (Vue package globs)
- New: `packages/vue` `size-limit` config

---

### Implementation guidelines

- Extend root scripts to cover `packages/vue` rather than adding a parallel set
  of scripts.
- Build core before Vue in CI so Vue tests run against the real
  `use-stellar/core` output.
- Add a size budget that ignores `@stellar/stellar-sdk` and `vue`.
- Keep job count and install steps consistent with the existing workflow.

---

### Acceptance criteria

- [ ] CI fails when a Vue test, lint rule, or type error fails
- [ ] A core change that breaks Vue fails CI
- [ ] Size budget is enforced for the Vue bundle
- [ ] The pre-push hook runs the Vue checks

---

### Reference

- CI workflow: `.github/workflows/ci.yml`
- Pre-push: `.husky/pre-push`
- Test gaps: `ci-01`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not weaken existing checks for `packages/core`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
