---
name: "Vue 24: Add the Vue useFederationLookup composable"
about: Port SEP-2 federation address resolution to Vue on the shared fetcher and cache.
title: "feat(vue): add the useFederationLookup composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useFederationLookup composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-13`

---

### Context

`useFederationLookup` resolves `alice*example.com` into an account ID plus
optional memo via SEP-2. It is keyed by address only because federation servers
are network-independent.

---

### Why this matters

Federation memos are required for exchange deposits; a dropped memo loses funds.
Vue must return the memo type and value exactly as React does.

---

### Where this lives

- New: `packages/vue/src/useFederationLookup.ts`
- New: `packages/vue/src/useFederationLookup.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `address` (a `name*domain` federation address) as a static value, a Vue
  `ref`, or a getter (`MaybeRefOrGetter`), and resolve them with `toValue`
  inside the query key getter.
- Delegate data loading to `fetchFederationRecord` from the React-free core and
  run it through the internal Vue `useQuery` adapter so the cache key is
  `federationKey` — identical to React.
- Return `record`, `loading`, `error`, and `refetch` as refs or computed values
  with the same field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Debounce is out of scope; callers control input timing. Do not add
  framework-specific debounce behavior.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] `memoType` and `memo` are returned unchanged from the fetcher
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useFederationLookup.ts`
- Shared fetcher: `fetchFederationRecord` (`vue-13`)
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
