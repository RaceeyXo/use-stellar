---
name: "React Native 24: Wire the React Native package into CI, release, and size budgets"
about: Run RN tests, typecheck, Metro bundle checks, size limits, and publishing in CI alongside core and Vue.
title: "ci(react-native): add CI checks, size budget, and release for @use-stellar/react-native"
labels: enhancement, react-native, framework-agnostic, ci, packaging
---

## Wire the React Native package into CI, release, and size budgets

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-09`, `rn-14`, `vue-42`

---

### Context

CI currently checks only core and the Next.js demo (`vue-42` adds Vue). The RN
package, its Metro bundle test, and its example app need the same guarantees and
a publish path.

---

### Why this matters

Core changes can break RN in ways web tests never see — a module-scope `window`
access, a new DOM import. CI must run RN checks on every core PR.

---

### Where this lives

- Update: root `package.json` scripts
- Update: `.github/workflows/ci.yml`
- Update: `.github/workflows/release.yml`
- Update: `.husky/pre-push`
- New: `packages/react-native` `size-limit` config

---

### Implementation guidelines

- Extend the root scripts used in `vue-42` rather than adding a parallel set.
- Run the Metro bundle test from `rn-09` in CI.
- Set a size budget excluding peers and optional native modules.
- Publish after core succeeds, with the same provenance settings (`ci-08`).

---

### Acceptance criteria

- [ ] CI fails on RN test, type, or bundle failures
- [ ] A core change that breaks RN fails CI
- [ ] Size budget is enforced
- [ ] The release workflow publishes the RN package after core

---

### Reference

- Vue CI wiring: `vue-42`
- Release hardening: `ci-08`
- CI workflow: `.github/workflows/ci.yml`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not weaken existing core or Vue checks.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
