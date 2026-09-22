---
name: "Vue 09: Add a reactive Vue useBalance composable"
about: Port the balance read flow to Vue using the shared query store, reactive inputs, and the common network runtime.
title: "feat(vue): add a reactive balance composable backed by QueryStore"
labels: enhancement, vue, framework-agnostic
---

## Add a reactive Vue useBalance composable

**Complexity:** High (150 points)
**Estimated time:** 1 day
**Depends on:** `vue-04`, `vue-07`

---

### Context

`useBalance` is a representative read hook: it resolves the active network,
fetches Horizon data, and uses the shared query cache. Port this one composable
to prove the runtime and cache can support Vue reactivity before attempting the
remaining read APIs.

---

### Why this matters

A single production-quality reactive query validates the framework-neutral cache
boundary. It also gives Vue users a useful first data API without committing to a
bulk hook rewrite.

---

### Where this lives

- New: `packages/vue/src/useBalance.ts`
- New: `packages/vue/src/useBalance.test.ts`
- Update: `packages/vue/src/index.ts`
- Update: shared query types only if a narrow adapter hook is required

---

### Implementation guidelines

- Accept a static address or Vue ref/getter, plus the existing balance options
  that can be supported without widening the API.
- Use the installed runtime’s network configuration and `QueryStore`; do not
  create a separate Vue cache.
- Watch reactive inputs, unsubscribe and refetch on change, and expose a manual
  `refetch` action.
- Preserve loading, data, error, and cancellation semantics as closely as Vue’s
  lifecycle allows.
- Mock Horizon in tests; do not use live network calls.

---

### Acceptance criteria

- [ ] Static and reactive addresses fetch the expected balance data
- [ ] Address changes unsubscribe from the old query and load the new query
- [ ] Two Vue scopes for the same query share one in-flight request
- [ ] Returned data, loading, error, and refetch values are reactive
- [ ] Scope disposal removes the query subscription
- [ ] Tests mock Horizon and use testnet fixtures only
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React implementation: `packages/core/src/hooks/useBalance.ts`
- Shared store: `packages/core/src/cache/store.ts`
- React cache adapter: `packages/core/src/cache/useQuery.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Reuse query keys and cache semantics; do not create a Vue-specific cache.
- Do not make real Horizon calls in tests.
- Use testnet only in fixtures and examples.
- Include `Closes #[issue number]` in the PR description.

