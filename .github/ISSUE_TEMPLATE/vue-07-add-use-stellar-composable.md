---
name: "Vue 07: Add the useStellar composable"
about: Expose the injected runtime as a typed Vue composable with reactive snapshots and explicit lifecycle cleanup.
title: "feat(vue): add the useStellar runtime composable"
labels: enhancement, vue, framework-agnostic, good first issue
---

## Add the useStellar composable

**Complexity:** Medium (100 points)
**Estimated time:** 1 day
**Depends on:** `vue-06`

---

### Context

Vue consumers need an ergonomic, typed way to access the installed shared runtime
and react to its state. Implement the base composable before porting individual
React hooks.

---

### Why this matters

Every later Vue composable should share one subscription pattern. Establishing it
once avoids leaking subscriptions, creating local runtime copies, or returning
inconsistent state shapes across the Vue API.

---

### Where this lives

- New: `packages/vue/src/useStellar.ts`
- New: `packages/vue/src/useStellar.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Inject the runtime through the plugin key and throw a clear error if absent.
- Subscribe on composable use and clean up via Vue’s scope-disposal API.
- Return readonly reactive state plus the runtime for advanced APIs; do not expose
  mutable internal snapshots.
- Ensure the composable works in component setup and composable test harnesses.
- Do not port wallet or data-fetching behavior in this issue.

---

### Acceptance criteria

- [ ] `useStellar()` returns the installed runtime and a reactive readonly snapshot
- [ ] Runtime changes update the returned state
- [ ] Stopping a component scope unsubscribes from the runtime
- [ ] Calling it without the plugin yields an actionable error
- [ ] Tests prove no listener remains after scope disposal
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- Vue injection boundary: `vue-06`
- Runtime API: `vue-02`
- React context consumer: `packages/core/src/context/StellarProvider.tsx`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Subscribe through the shared runtime; never create one inside the composable.
- Return readonly state and preserve runtime ownership in the plugin.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.

