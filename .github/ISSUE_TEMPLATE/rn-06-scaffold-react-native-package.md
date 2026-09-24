---
name: "React Native 06: Scaffold the @use-stellar/react-native package"
about: Add a publishable workspace package that re-exports the React hooks and hosts React Native platform integrations.
title: "feat(react-native): scaffold the @use-stellar/react-native package"
labels: enhancement, react-native, framework-agnostic, good first issue
---

## Scaffold the @use-stellar/react-native package

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-03`

---

### Context

React hooks already run on React Native once core is platform-safe. What RN
needs is a thin package that re-exports them and adds native integrations: a
provider with AppState/NetInfo/AsyncStorage wiring, polyfills, and mobile wallet
connection.

---

### Why this matters

A dedicated package keeps native dependencies (AsyncStorage, NetInfo,
WalletConnect) out of web bundles and gives RN users one install target.

---

### Where this lives

- New: `packages/react-native/package.json`
- New: `packages/react-native/tsconfig.json`
- New: `packages/react-native/tsup.config.ts`
- New: `packages/react-native/src/index.ts`
- Update: root scripts as needed

---

### Implementation guidelines

- Depend on `use-stellar`; declare `react` and `react-native` as peers and
  native modules as optional peers.
- Re-export all public hooks and types from `use-stellar` so apps import from
  one place.
- Build CJS and ESM with type declarations; externalize `react`, `react-native`,
  and `@stellar/stellar-sdk`.
- Do not add integration code yet — scaffold only.

---

### Acceptance criteria

- [ ] `pnpm --filter @use-stellar/react-native build` produces JS and types
- [ ] All public `use-stellar` hooks are re-exported
- [ ] No native module is a hard dependency
- [ ] Typecheck passes for the new package

---

### Reference

- Vue scaffold for comparison: `vue-05`
- Core manifest: `packages/core/package.json`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- React Native reuses the React hooks from `use-stellar`; do not fork or
  re-implement a hook inside `packages/react-native`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
