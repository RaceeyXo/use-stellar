---
name: "React Native 14: Add a React Native test harness and native module mocks"
about: Provide a Jest preset, render helpers, and deterministic mocks for AppState, NetInfo, AsyncStorage, Linking, and WalletConnect.
title: "test(react-native): add the RN test harness and native module mocks"
labels: enhancement, react-native, framework-agnostic, testing
---

## Add a React Native test harness and native module mocks

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-07`

---

### Context

Hook verification on RN needs `@testing-library/react-native`, the
`react-native` Jest preset, and mocks for native modules. Without a shared
harness, each test file will mock differently and flake.

---

### Why this matters

Mobile lifecycle bugs (background, offline, app switch) are only testable with
controllable fakes. A harness that can flip AppState and connectivity makes
those bugs reproducible.

---

### Where this lives

- New: `packages/react-native/jest.config.js`
- New: `packages/react-native/src/test-utils/render.tsx`
- New: `packages/react-native/src/test-utils/mocks/` (AppState, NetInfo, AsyncStorage, Linking, WalletConnect)
- New: `packages/react-native/src/test-utils/harness.test.tsx`

---

### Implementation guidelines

- Expose `renderWithStellar(ui, options)` and helpers `setAppState()`,
  `setOnline()`, and `openUrl()`.
- Reuse the Horizon fixtures and SDK mock from core instead of copying them.
- Reset mocks and runtime between tests automatically.
- Keep tests deterministic with fake timers.

---

### Acceptance criteria

- [ ] A sample test flips AppState and asserts polling pauses
- [ ] A sample test flips connectivity and asserts fetching pauses
- [ ] Mocks reset between tests
- [ ] `pnpm --filter @use-stellar/react-native test` runs in CI

---

### Reference

- Vue harness: `vue-10`
- Core fixtures: `packages/core/src/__tests__/fixtures/`
- SDK mock: `test-04`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Mock Horizon, Soroban RPC, wallets, and native modules in tests; make no live
  network calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
