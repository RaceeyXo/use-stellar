---
name: "Vue 28: Add the Vue usePayments composable"
about: Port paginated, normalized payment lists to Vue using the shared cursor model.
title: "feat(vue): add the usePayments composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue usePayments composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-14`

---

### Context

`usePayments` lists payment operations as `NormalizedPayment` records with an
`incoming`/`outgoing` direction relative to the viewing account.

---

### Why this matters

Direction is computed relative to the address being viewed. Vue must reuse the
shared normalizer so a payment never flips direction between frameworks.

---

### Where this lives

- New: `packages/vue/src/usePayments.ts`
- New: `packages/vue/src/usePayments.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `address`, `limit`, `order`, and `cursor` as a static value, a Vue
  `ref`, or a getter (`MaybeRefOrGetter`), and resolve them with `toValue`
  inside the query key getter.
- Delegate data loading to `fetchPaymentsPage` from the React-free core and run
  it through the internal Vue `useQuery` adapter so the cache key is
  `paymentsKey` — identical to React.
- Return `payments`, `loading`, `error`, `refetch`, `fetchNext`, `fetchPrev`,
  `hasNext`, and `hasPrev` as refs or computed values with the same field names
  and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Reset to the first page when `address`, `limit`, or `order` changes.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] Direction matches React for sent, received, and self payments
- [ ] Paging behaves identically to `vue-27`
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/usePayments.ts`
- Shared fetcher: `fetchPaymentsPage` (`vue-14`)
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
