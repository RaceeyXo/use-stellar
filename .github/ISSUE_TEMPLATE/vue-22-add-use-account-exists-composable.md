---
name: "Vue 22: Add the Vue useAccountExists composable"
about: Port the funded-account check to Vue, including the invalid_format and not_funded reasons.
title: "feat(vue): add the useAccountExists composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useAccountExists composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-13`

---

### Context

`useAccountExists` tells a UI whether a destination is funded before a payment
is attempted, with a `reason` of `exists`, `not_funded`, `invalid_format`, or
`idle`. Invalid StrKeys short-circuit without a network call.

---

### Why this matters

Payment forms rely on this to offer create-account flows instead of failed
payments. The reason mapping must be identical across frameworks.

---

### Where this lives

- New: `packages/vue/src/useAccountExists.ts`
- New: `packages/vue/src/useAccountExists.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `address` as a static value, a Vue `ref`, or a getter
  (`MaybeRefOrGetter`), and resolve them with `toValue` inside the query key
  getter.
- Delegate data loading to `fetchAccountExists` from the React-free core and run
  it through the internal Vue `useQuery` adapter so the cache key is
  `accountKey` — identical to React.
- Return `exists`, `reason`, `loading`, `error`, and `refetch` as refs or
  computed values with the same field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Short-circuit invalid addresses to `invalid_format` without a request, using
  the shared validator.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] Invalid addresses resolve to `invalid_format` with no request
- [ ] A 404 resolves to `not_funded` and is not surfaced as an error
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useAccountExists.ts`
- Shared fetcher: `fetchAccountExists` (`vue-13`)
- Internal query adapter: `vue-12`
- Cache keys: `packages/core/src/cache/keys.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Do not change the React hook’s public API or cache keys.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
