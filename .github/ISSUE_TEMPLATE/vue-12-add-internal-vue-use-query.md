---
name: "Vue 12: Add the internal Vue useQuery adapter and migrate useBalance"
about: Adapt the shared QueryObserver to Vue reactivity once, so every read composable gets identical caching, dedup, and cleanup behavior.
title: "feat(vue): add an internal useQuery adapter over QueryObserver"
labels: enhancement, vue, framework-agnostic
---

## Add the internal Vue useQuery adapter and migrate useBalance

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-09`, `vue-11`

---

### Context

Every Vue read composable needs the same plumbing: resolve a reactive key,
subscribe to the store, fetch on key change, expose reactive
`data`/`loading`/`error`/`updatedAt`, and clean up on scope disposal.

Build that plumbing once as a private `useQuery` for the Vue package on top of
the `QueryObserver` from `vue-11`, then move `useBalance` (from `vue-09`) onto
it as the first consumer.

---

### Why this matters

Without one adapter, eighteen composables would each hand-roll watchers and
subscriptions, and each would leak or double-fetch in its own way. One adapter
keeps lifecycle bugs fixable in one place.

---

### Where this lives

- New: `packages/vue/src/internal/useQuery.ts`
- New: `packages/vue/src/internal/useQuery.test.ts`
- Update: `packages/vue/src/useBalance.ts`

---

### Implementation guidelines

- Accept a key getter, a `queryFn`, an `enabled` getter, and an optional
  `staleTime`; derive everything reactively with `computed`/`watch`.
- Hold one observer per call, call `observer.setOptions` when the serialized key
  changes, and `destroy()` it in `onScopeDispose`.
- Expose `shallowRef` state so large Horizon payloads are not deeply proxied.
- Keep it internal: do not export it from `packages/vue/src/index.ts`.
- Migrate `useBalance` without changing its public return shape.

---

### Acceptance criteria

- [ ] Key changes trigger exactly one fetch and one resubscribe
- [ ] Two composables on the same key share one request
- [ ] Scope disposal drops the subscriber count so GC can run
- [ ] `enabled` flipping false stops fetching without clearing cached data
- [ ] `useBalance` tests from `vue-09` pass unchanged on the new adapter
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- Shared observer: `vue-11`
- React adapter for comparison: `packages/core/src/cache/useQuery.ts`
- First consumer: `vue-09`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not create a Vue-specific cache or store.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
