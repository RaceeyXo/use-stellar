---
name: "React Native 07: Add a React Native StellarProvider with native platform wiring"
about: Wrap the React provider with native platform capabilities: AppState focus, NetInfo connectivity, and AsyncStorage sessions.
title: "feat(react-native): add a native StellarProvider wired to AppState, NetInfo, and storage"
labels: enhancement, react-native, framework-agnostic
---

## Add a React Native StellarProvider with native platform wiring

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-02`, `rn-04`, `rn-05`, `rn-06`

---

### Context

With capabilities, focus, connectivity, and storage abstracted in core (`rn-01`,
`rn-02`, `rn-04`, `rn-05`), the RN package needs a provider that plugs in the
native implementations and otherwise behaves exactly like `StellarProvider`.

---

### Why this matters

A correct default provider is what makes the library ‘just work’ on mobile.
Without it, every app would wire AppState and NetInfo by hand and get subtle
lifecycle bugs.

---

### Where this lives

- New: `packages/react-native/src/StellarProvider.tsx`
- New: `packages/react-native/src/platform/appStateFocus.ts`
- New: `packages/react-native/src/platform/netInfoOnline.ts`
- New: `packages/react-native/src/platform/asyncStorageSession.ts`
- New: matching tests

---

### Implementation guidelines

- Accept the same props as the web `StellarProvider`; add only optional
  overrides for storage and platform.
- Declare `kind: "native"` capabilities so wallet connection is permitted.
- Subscribe to AppState and NetInfo on mount and unsubscribe on unmount.
- Fall back gracefully (always-online, in-memory session) if an optional native
  module is absent, with a dev-only warning.

---

### Acceptance criteria

- [ ] Props and hook behavior match the web provider
- [ ] Backgrounding the app pauses polling; foregrounding refetches stale data
- [ ] Connectivity changes pause and resume fetching
- [ ] Sessions persist through AsyncStorage when installed
- [ ] Missing optional modules do not crash the app
- [ ] RN package tests and typecheck pass

---

### Reference

- Web provider: `packages/core/src/context/StellarProvider.tsx`
- Core managers: `rn-04`, `rn-05`
- Session storage: `rn-02`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- React Native reuses the React hooks from `use-stellar`; do not fork or
  re-implement a hook inside `packages/react-native`.
- Mock Horizon, Soroban RPC, wallets, and native modules in tests; make no live
  network calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
