---
name: "React Native 09: Add react-native export conditions and a Metro resolution test"
about: Make Metro resolve the correct entries for use-stellar and @use-stellar/react-native, with a test that bundles a fixture app.
title: "build(react-native): add react-native export conditions and Metro resolution checks"
labels: enhancement, react-native, framework-agnostic, packaging
---

## Add react-native export conditions and a Metro resolution test

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-06`, `vue-04`

---

### Context

Metro honours the `react-native` export condition and package `exports` only in
recent versions and with `unstable_enablePackageExports`. Without explicit
conditions, Metro may pick an entry with dynamic imports of web-only wallet SDKs
(for example `@albedo-link/intent`).

---

### Why this matters

Resolution bugs appear only at bundle time on a developer’s machine. A CI bundle
of a fixture app catches them before release.

---

### Where this lives

- Update: `packages/core/package.json` (`exports` conditions)
- Update: `packages/react-native/package.json` (`exports`, `react-native` field)
- New: `packages/react-native/test-fixtures/metro-app/`
- New: `packages/react-native/scripts/metro-bundle-test.js`

---

### Implementation guidelines

- Add a `react-native` condition that points to an entry without web-only wallet
  imports.
- Bundle a minimal fixture with Metro in CI and assert success.
- Fail the test if web-only wallet SDKs are present in the bundle.
- Coordinate the exports map with `pkg-01` and `vue-04`.

---

### Acceptance criteria

- [ ] A fixture app bundles with Metro using package exports
- [ ] The RN bundle excludes Freighter and Albedo browser SDKs
- [ ] Web and Node resolution are unchanged
- [ ] The bundle test runs in CI

---

### Reference

- Exports map: `pkg-01`
- Core subpath: `vue-04`
- Metro package exports: https://reactnative.dev/blog/2023/06/21/package-exports-support

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not change web entry points’ behavior.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
