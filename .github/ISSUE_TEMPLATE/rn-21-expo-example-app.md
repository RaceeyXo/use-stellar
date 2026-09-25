---
name: "React Native 21: Add an Expo example app for React Native"
about: Ship a runnable Expo app on testnet demonstrating provider setup, reads, history, WalletConnect signing, and payments.
title: "feat(demo): add an Expo example app for @use-stellar/react-native"
labels: enhancement, react-native, framework-agnostic, demo
---

## Add an Expo example app for React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-11`, `rn-15`, `rn-18`

---

### Context

RN developers need a working reference showing polyfills, the native provider,
WalletConnect configuration, deep-link scheme setup, and the hooks in real
screens.

---

### Why this matters

Mobile setup has many moving parts — polyfills, `app.json` scheme, WalletConnect
metadata. A runnable example is the fastest way to prove they fit together and
the best place to copy from.

---

### Where this lives

- New: `examples/react-native-expo/`
- Update: root `README.md` (examples section)

---

### Implementation guidelines

- Use Expo SDK’s current stable release with a development build (WalletConnect
  needs native modules).
- Screens: connect wallet, balance and account, payment history with infinite
  scroll, send payment.
- Default to testnet; read the WalletConnect `projectId` from environment
  config, never commit one.
- Consume `@use-stellar/react-native` via the workspace.

---

### Acceptance criteria

- [ ] `npx expo export` (or equivalent build check) succeeds in CI
- [ ] No secrets or WalletConnect `projectId` are committed
- [ ] Only public package exports are used
- [ ] README explains how to run it against testnet

---

### Reference

- Web demo: `packages/demo`
- Vue demo: `vue-40`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Never commit secret keys or WalletConnect project IDs.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
