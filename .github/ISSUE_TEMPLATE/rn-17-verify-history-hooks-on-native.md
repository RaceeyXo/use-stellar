---
name: "React Native 17: Verify paginated history hooks on React Native"
about: Prove transaction, payment, payment-history, and trades paging works with FlatList-style infinite lists on RN.
title: "test(react-native): verify paginated history hooks and FlatList paging"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify paginated history hooks on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-14`

---

### Context

Mobile activity feeds use `FlatList` with `onEndReached`. The history hooks
expose `fetchNext`/`hasNext`, which must behave correctly when called repeatedly
by list virtualization.

---

### Why this matters

`onEndReached` can fire several times in quick succession. If `fetchNext` is not
idempotent while in flight, the list skips or duplicates pages.

---

### Where this lives

- New: `packages/react-native/src/__tests__/useTransactionHistory.native.test.tsx`
- New: `packages/react-native/src/__tests__/usePayments.native.test.tsx`
- New: `packages/react-native/src/__tests__/usePaymentHistory.native.test.tsx`
- New: `packages/react-native/src/__tests__/useTrades.native.test.tsx`
- Update: `packages/core/src/` only at the owner layer of any platform defect found
- Update: `packages/react-native/src/index.ts` (re-exports)

---

### Implementation guidelines

- Render `useTransactionHistory`, `usePayments`, `usePaymentHistory`,
  `useTrades` inside the RN `StellarProvider` with
  `@testing-library/react-native` and the RN harness from `rn-14`.
- Drive `fetchNext` from a `FlatList` `onEndReached` in tests and assert no
  duplicate or skipped pages.
- If `fetchNext` is not idempotent while loading, fix it in the shared
  pagination helpers from `vue-14`.
- If a hook fails on RN, fix the root cause in core (runtime, fetcher, or
  utility) rather than adding an RN-only branch.
- Re-export the hooks from `@use-stellar/react-native` so apps depend on one
  package.

---

### Acceptance criteria

- [ ] Rapid `onEndReached` calls load each page exactly once
- [ ] `hasNext` becomes false at the end of history
- [ ] Filters in `usePaymentHistory` behave as on web
- [ ] Hook return shapes are identical to the web build
- [ ] No `window`, `document`, or `react-dom` access occurs
- [ ] RN package tests, typecheck, and core tests pass

---

### Reference

- Pagination helpers: `vue-14`
- Paging issues: `state-05`, `state-07`

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
