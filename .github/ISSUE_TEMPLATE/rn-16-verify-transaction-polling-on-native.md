---
name: "React Native 16: Verify useTransaction polling on React Native"
about: Prove watch-until-final polling respects AppState and connectivity on RN.
title: "test(react-native): verify useTransaction polling with AppState and NetInfo"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify useTransaction polling on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-14`

---

### Context

`useTransaction({ watch: true })` is the typical follow-up to a payment on
mobile, often while the user is switching back from a wallet app. It must pause
in the background and finish promptly on return.

---

### Why this matters

Polling that keeps running in the background drains battery; polling that stops
and never resumes leaves users staring at ‘pending’.

---

### Where this lives

- New: `packages/react-native/src/__tests__/useTransaction.native.test.tsx`
- Update: `packages/core/src/` only at the owner layer of any platform defect found
- Update: `packages/react-native/src/index.ts` (re-exports)

---

### Implementation guidelines

- Render `useTransaction` inside the RN `StellarProvider` with
  `@testing-library/react-native` and the RN harness from `rn-14`.
- Background the app mid-poll and assert no fetches occur until foreground.
- Go offline mid-poll and assert polling resumes on reconnect.
- If a hook fails on RN, fix the root cause in core (runtime, fetcher, or
  utility) rather than adding an RN-only branch.
- Re-export the hooks from `@use-stellar/react-native` so apps depend on one
  package.

---

### Acceptance criteria

- [ ] Polling pauses in background and resumes with one fetch
- [ ] Polling stops at a final status
- [ ] Offline periods do not produce error flicker
- [ ] Hook return shapes are identical to the web build
- [ ] No `window`, `document`, or `react-dom` access occurs
- [ ] RN package tests, typecheck, and core tests pass

---

### Reference

- Hook: `packages/core/src/hooks/useTransaction.ts`
- Focus and online managers: `rn-04`, `rn-05`

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
