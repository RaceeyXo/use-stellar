---
name: "Vue 05: Scaffold the @use-stellar/vue adapter package"
about: Add a publishable Vue 3 workspace package with Vue as a peer dependency and the shared core as its runtime dependency.
title: "feat(vue): scaffold the @use-stellar/vue adapter package"
labels: enhancement, vue, framework-agnostic, good first issue
---

## Scaffold the @use-stellar/vue adapter package

**Complexity:** Medium (100 points)
**Estimated time:** 1 day
**Depends on:** `vue-04`

---

### Context

The monorepo has a React-only publishable package. Create the smallest viable
Vue 3 adapter package so Vue work has a dedicated build, types, peer dependency,
and package test surface rather than leaking Vue into the shared core.

---

### Why this matters

Without an explicit adapter package, consumers cannot install Vue support without
also inheriting React package metadata. A workspace package establishes a stable
home for Vue-specific APIs and releases.

---

### Where this lives

- New: `packages/vue/package.json`
- New: `packages/vue/tsconfig.json`
- New: `packages/vue/tsup.config.ts`
- New: `packages/vue/src/index.ts`
- Update: `pnpm-workspace.yaml` only if required
- Update: root package scripts or package-test wiring as needed

---

### Implementation guidelines

- Use the package name `@use-stellar/vue` and peer dependency `vue` compatible
  with Vue 3.
- Depend on the local `use-stellar` workspace package and import shared runtime
  APIs from `use-stellar/core`.
- Configure ESM, CommonJS, declarations, `sideEffects: false`, and a minimal
  smoke test or build verification.
- Export only a placeholder/version-safe adapter surface; plugin and composables
  are separate issues.
- Do not add Vue as a dependency of `packages/core`.

---

### Acceptance criteria

- [ ] `pnpm --filter @use-stellar/vue build` produces ESM, CommonJS, and types
- [ ] Vue is a peer dependency, not a dependency of shared core
- [ ] The adapter can import a type or runtime symbol from `use-stellar/core`
- [ ] Package metadata is ready for a future publish without exposing React APIs
- [ ] Existing core and demo builds remain unaffected
- [ ] Build, typecheck, and package smoke test pass

---

### Reference

- Existing publishable package: `packages/core/package.json`
- Workspace conventions: `pnpm-workspace.yaml`
- Shared runtime export: `vue-04`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Keep this package Vue-only; do not add adapter code to `packages/core`.
- Use workspace protocol dependencies where the repository conventions require it.
- Do not publish or modify release automation in this issue.
- Include `Closes #[issue number]` in the PR description.
