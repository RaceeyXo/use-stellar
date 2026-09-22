---
name: "Vue 04: Publish a React-free core subpath export"
about: Expose runtime, wallet, cache, error, and type primitives from use-stellar/core without loading React.
title: "feat(package): add a React-free use-stellar/core export"
labels: enhancement, vue, framework-agnostic, packaging
---

## Publish a React-free core subpath export

**Complexity:** High (150 points)
**Estimated time:** 1 day
**Depends on:** `vue-01`, `vue-02`, `vue-03`

---

### Context

The published `use-stellar` entry point exports React hooks and has React peer
dependencies. A Vue adapter needs an importable core boundary containing the
runtime primitives without loading React or React-specific declarations.

---

### Why this matters

A genuine React-free import boundary lets Vue, server-side tools, and future
framework adapters share the same SDK behavior while keeping React as an optional
adapter dependency.

---

### Where this lives

- New: `packages/core/src/core.ts`
- Update: `packages/core/package.json`
- Update: `packages/core/tsup.config.ts`
- Update: `packages/core/scripts/smoke-test.js`
- Update: `packages/core/src/index.ts`

---

### Implementation guidelines

- Add a `use-stellar/core` subpath that exports only framework-neutral runtime,
  cache, wallet-adapter, error, utility, and type APIs.
- Configure declarations and both ESM/CommonJS output for the new entry.
- Keep the existing root import fully backward compatible for React users.
- Add a package smoke test that imports the core subpath in plain Node and proves
  it does not resolve React at runtime.
- Do not move or port React hooks in this issue.

---

### Acceptance criteria

- [ ] `import { createStellarRuntime } from "use-stellar/core"` typechecks
- [ ] The core entry has ESM, CommonJS, and declaration output
- [ ] Importing `use-stellar/core` does not require React to be installed
- [ ] Existing `use-stellar` root exports remain unchanged
- [ ] Package smoke test covers both root and core entry points
- [ ] `pnpm --filter use-stellar build`, typecheck, and package tests pass

---

### Reference

- Current export surface: `packages/core/src/index.ts`
- Package metadata: `packages/core/package.json`
- Build configuration: `packages/core/tsup.config.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Do not make React a dependency of the core subpath.
- Do not rename or remove existing root exports.
- Keep bundle-size configuration current if a new entry changes it.
- Include `Closes #[issue number]` in the PR description.

