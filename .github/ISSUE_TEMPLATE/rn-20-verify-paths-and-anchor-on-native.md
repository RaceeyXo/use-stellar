---
name: "React Native 20: Verify usePaymentPaths and useAnchor on React Native"
about: Prove path discovery with quote polling and SEP-1 stellar.toml resolution work on RN networking.
title: "test(react-native): verify usePaymentPaths and useAnchor on RN"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify usePaymentPaths and useAnchor on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-14`

---

### Context

`usePaymentPaths` polls quotes while a swap screen is open. `useAnchor` fetches
and parses `stellar.toml` over HTTPS with abort and timeout handling — both
depend on RN’s `fetch` and `AbortController` behavior.

---

### Why this matters

Swap quotes that keep polling in background waste quota; anchor lookups that
ignore abort leak requests when users navigate away.

---

### Where this lives

- New: `packages/react-native/src/__tests__/usePaymentPaths.native.test.tsx`
- New: `packages/react-native/src/__tests__/useAnchor.native.test.tsx`
- Update: `packages/core/src/` only at the owner layer of any platform defect found
- Update: `packages/react-native/src/index.ts` (re-exports)

---

### Implementation guidelines

- Render `usePaymentPaths`, `useAnchor` inside the RN `StellarProvider` with
  `@testing-library/react-native` and the RN harness from `rn-14`.
- Assert quote polling pauses in background.
- Assert `useAnchor` aborts on domain change and unmount under RN’s
  `AbortController`.
- If a hook fails on RN, fix the root cause in core (runtime, fetcher, or
  utility) rather than adding an RN-only branch.
- Re-export the hooks from `@use-stellar/react-native` so apps depend on one
  package.

---

### Acceptance criteria

- [ ] Both path modes return the same data as on web
- [ ] Quote polling pauses in background
- [ ] Anchor requests abort on change and unmount
- [ ] Hook return shapes are identical to the web build
- [ ] No `window`, `document`, or `react-dom` access occurs
- [ ] RN package tests, typecheck, and core tests pass

---

### Reference

- Fetchers: `vue-17`
- Hooks: `packages/core/src/hooks/usePaymentPaths.ts`, `useAnchor.ts`

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
