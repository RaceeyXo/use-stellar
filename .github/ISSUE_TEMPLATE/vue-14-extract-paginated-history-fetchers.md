---
name: "Vue 14: Extract framework-neutral paginated history fetchers"
about: Move payments, transaction-history, and trades paging plus normalization out of React hooks into a shared cursor-aware module.
title: "refactor(core): extract paginated history fetchers and cursor model"
labels: enhancement, vue, framework-agnostic, refactor
---

## Extract framework-neutral paginated history fetchers

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-13`

---

### Context

`usePayments`, `useTransactionHistory`, and `useTrades` each implement a Horizon
call, record normalization (`NormalizedPayment`, `NormalizedTransaction`,
`NormalizedTrade`), and a cursor model for
`fetchNext`/`fetchPrev`/`hasNext`/`hasPrev` inside React state.

Extract the page fetch, normalization, and cursor arithmetic into pure functions
so Vue can offer the same paging without re-deriving the cursor rules.

---

### Why this matters

Pagination is subtle: `state-05` and `state-07` already track stale cursors and
dead-end `hasNext`. Those fixes must land once and apply to both frameworks.

---

### Where this lives

- New: `packages/core/src/queries/payments.ts`
- New: `packages/core/src/queries/transactionHistory.ts`
- New: `packages/core/src/queries/trades.ts`
- New: `packages/core/src/queries/pagination.ts`
- New: matching `*.test.ts` files
- Update: `packages/core/src/hooks/usePayments.ts`, `useTransactionHistory.ts`, `useTrades.ts`

---

### Implementation guidelines

- Expose `fetchXPage(networkConfig, params, cursor, { signal })` returning `{
records, nextCursor, prevCursor, hasNext, hasPrev }`.
- Keep direction/asset filtering for payment history as a pure helper so
  `usePaymentHistory` in both frameworks shares it.
- Keep query keys from `cache/keys.ts` unchanged.
- Refactor the React hooks to use the shared functions with no public API
  change.

---

### Acceptance criteria

- [ ] Page fetch, normalization, and cursor derivation are tested without React
- [ ] Payment direction relative to the viewing account is computed identically to today
- [ ] Trades keep the `baseIsSeller`/`side` semantics
- [ ] Existing history hook tests pass unchanged
- [ ] Exports are available from `use-stellar/core`
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Current hooks: `packages/core/src/hooks/usePayments.ts`, `useTransactionHistory.ts`, `useTrades.ts`, `usePaymentHistory.ts`
- Known paging issues: `state-05`, `state-06`, `state-07`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not fold unrelated pagination bug fixes into this extraction.
- Do not import React or Vue from `packages/core/src/runtime`, `queries`, or
  `actions`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
