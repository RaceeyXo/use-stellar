---
name: "React Native 19: Verify Soroban hooks on React Native"
about: Prove Soroban simulation and contract-event polling work on Hermes, including BigInt-based i128/u128 decoding.
title: "test(react-native): verify Soroban hooks and BigInt decoding on Hermes"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify Soroban hooks on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-08`, `rn-14`

---

### Context

Soroban values such as `i128` and `u128` decode to `BigInt`. Hermes supports
`BigInt`, but polyfills and serialization helpers (for example `JSON.stringify`
in args keys) can break on it. Contract-event polling also needs to respect
AppState.

---

### Why this matters

Token balances on Soroban are `i128`. A decoding failure shows users a zero or
crashes the screen.

---

### Where this lives

- New: `packages/react-native/src/__tests__/useSorobanContract.native.test.tsx`
- New: `packages/react-native/src/__tests__/useContractEvents.native.test.tsx`
- Update: `packages/core/src/` only at the owner layer of any platform defect found
- Update: `packages/react-native/src/index.ts` (re-exports)

---

### Implementation guidelines

- Render `useSorobanContract`, `useContractEvents` inside the RN
  `StellarProvider` with `@testing-library/react-native` and the RN harness from
  `rn-14`.
- Cover `BigInt` results and `BigInt` arguments in args-key serialization.
- Assert the contract-event poller pauses in background via the focus manager.
- If a hook fails on RN, fix the root cause in core (runtime, fetcher, or
  utility) rather than adding an RN-only branch.
- Re-export the hooks from `@use-stellar/react-native` so apps depend on one
  package.

---

### Acceptance criteria

- [ ] `i128`/`u128` results decode to correct `BigInt` values on Hermes
- [ ] Args with `BigInt` serialize to a stable cache key
- [ ] Event polling pauses in background
- [ ] Hook return shapes are identical to the web build
- [ ] No `window`, `document`, or `react-dom` access occurs
- [ ] RN package tests, typecheck, and core tests pass

---

### Reference

- Soroban services: `vue-16`
- Polyfills: `rn-08`

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
