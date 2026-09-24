---
name: "Vue 34: Add the Vue useContractEvents composable"
about: Stream Soroban contract events into Vue using the shared contract-event poller.
title: "feat(vue): add the useContractEvents composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useContractEvents composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-07`, `vue-16`

---

### Context

`useContractEvents` polls Soroban RPC `getEvents` for one or more contracts,
with topic filters, a start ledger, an interval, and a bounded event buffer.
`vue-16` moves the poller into core.

---

### Why this matters

Event feeds run for the lifetime of a page. Leaked pollers multiply RPC load; a
Vue composable must tie the poller’s lifetime to its effect scope exactly.

---

### Where this lives

- New: `packages/vue/src/useContractEvents.ts`
- New: `packages/vue/src/useContractEvents.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Create one shared poller per composable call and `stop()` it in
  `onScopeDispose`.
- Recreate the poller when `contractIds`, `topics`, or `startLedger` change;
  update interval without losing buffered events where the poller supports it.
- Expose `events` as a `shallowRef` and `clear()` as an action.
- Respect `enabled: false`.

---

### Acceptance criteria

- [ ] Events from a mocked RPC appear reactively and respect `bufferSize`
- [ ] Changing contract IDs restarts polling from the correct ledger
- [ ] Disposal stops the timer and ignores in-flight responses
- [ ] `clear()` empties the buffer without stopping polling
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useContractEvents.ts`
- Shared poller: `vue-16`

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
