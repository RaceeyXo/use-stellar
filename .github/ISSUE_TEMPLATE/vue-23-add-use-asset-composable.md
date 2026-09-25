---
name: "Vue 23: Add the Vue useAsset composable"
about: Port asset metadata lookup to Vue on the shared fetcher and cache.
title: "feat(vue): add the useAsset composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useAsset composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-13`

---

### Context

`useAsset` looks up an issued asset on Horizon and returns `AssetInfo`. It
honours `autoFetch: false` for manual loading and caches under `assetKey`.

---

### Why this matters

Asset lookups appear in every token list and trustline flow; sharing the cache
prevents redundant Horizon calls in mixed React/Vue pages.

---

### Where this lives

- New: `packages/vue/src/useAsset.ts`
- New: `packages/vue/src/useAsset.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `code`, `issuer`, `autoFetch`, and `staleTime` as a static value, a Vue
  `ref`, or a getter (`MaybeRefOrGetter`), and resolve them with `toValue`
  inside the query key getter.
- Delegate data loading to `fetchAsset` from the React-free core and run it
  through the internal Vue `useQuery` adapter so the cache key is `assetKey` —
  identical to React.
- Return `asset`, `loading`, `error`, and `refetch` as refs or computed values
  with the same field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Honour `autoFetch: false`: no automatic request, but `refetch()` still works.
- Validate the asset code and issuer with the shared utilities before
  requesting.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] `autoFetch: false` makes no request until `refetch()`
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useAsset.ts`
- Shared fetcher: `fetchAsset` (`vue-13`)
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
