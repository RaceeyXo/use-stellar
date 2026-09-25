---
name: "Vue 29: Add the Vue usePaymentHistory composable"
about: Compose usePayments with the shared direction and asset filters to provide filtered payment history in Vue.
title: "feat(vue): add the usePaymentHistory composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue usePaymentHistory composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-14`, `vue-28`

---

### Context

React’s `usePaymentHistory` wraps `usePayments` and filters by `direction`
(`incoming`, `outgoing`, `all`) and by asset. Port it by composing the Vue
`usePayments` composable with the shared pure filter from `vue-14`.

---

### Why this matters

Filtered history powers per-asset activity views. The filter must be the same
function in both frameworks so a native XLM filter never matches an issued
asset.

---

### Where this lives

- New: `packages/vue/src/usePaymentHistory.ts`
- New: `packages/vue/src/usePaymentHistory.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Compose the Vue `usePayments`; do not fetch separately.
- Apply the shared filter in a `computed` so filter changes do not refetch.
- Accept `direction` and `asset` as static values, refs, or getters.
- Preserve paging semantics and document that filtering is page-local, matching
  React (see `state-08`).

---

### Acceptance criteria

- [ ] Direction and asset filters match React on the same fixtures
- [ ] Changing a filter does not issue a new request
- [ ] Paging controls pass through from `usePayments`
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/usePaymentHistory.ts`
- Shared filter: `vue-14`
- Server-side filtering follow-up: `state-08`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
