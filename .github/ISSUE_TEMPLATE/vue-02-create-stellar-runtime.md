---
name: "Vue 02: Introduce a framework-neutral Stellar runtime"
about: Create an observable runtime that owns resolved network configuration, wallet state, and the query store outside React.
title: "feat(core): add a framework-neutral Stellar runtime"
labels: enhancement, vue, framework-agnostic
---

## Introduce a framework-neutral Stellar runtime

**Complexity:** High (150 points)
**Estimated time:** 1 day
**Depends on:** `vue-01`

---

### Context

`StellarProvider` currently owns React state for the active network, wallet, and
`QueryStore`. Framework adapters need the same state without calling React hooks.
Create a small runtime object that owns this state and exposes snapshots plus
subscriptions; React and Vue can each adapt it to their own reactivity model.

---

### Why this matters

A shared runtime prevents separate React and Vue implementations from drifting in
wallet state, cache ownership, or network changes. It is the boundary that makes
the SDK framework-agnostic without rewriting every hook at once.

---

### Where this lives

- New: `packages/core/src/runtime/StellarRuntime.ts`
- New: `packages/core/src/runtime/StellarRuntime.test.ts`
- Update: `packages/core/src/context/StellarProvider.tsx`
- Update: `packages/core/src/index.ts`

---

### Implementation guidelines

- Provide a `createStellarRuntime(options)` factory with resolved network config,
  one `QueryStore`, wallet state, `getSnapshot()`, `subscribe(listener)`, and
  explicit update methods.
- Expose immutable snapshots; consumers must not mutate runtime state directly.
- Keep auto-connect and framework lifecycle handling out of scope for this issue.
- Adapt `StellarProvider` to use one stable runtime instance without changing its
  existing public API.
- Do not import React or Vue from the runtime module.

---

### Acceptance criteria

- [ ] A runtime can be created and used in a plain TypeScript test
- [ ] Network and wallet updates notify subscribers exactly once per change
- [ ] The runtime owns one stable `QueryStore` instance
- [ ] Unsubscribing prevents further notifications
- [ ] `StellarProvider` preserves its current public behavior through the runtime
- [ ] Public runtime types and factory are exported from a non-React boundary
- [ ] `pnpm lint`, `pnpm typecheck`, and the affected tests pass

---

### Reference

- React-owned state today: `packages/core/src/context/StellarProvider.tsx`
- Shared cache: `packages/core/src/cache/store.ts`
- Wallet types: `packages/core/src/types/index.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Keep the runtime dependency-free with respect to UI frameworks.
- Do not change hook return shapes or cache semantics.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.

