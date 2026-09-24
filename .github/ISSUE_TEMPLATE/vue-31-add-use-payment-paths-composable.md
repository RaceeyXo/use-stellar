---
name: "Vue 31: Add the Vue usePaymentPaths composable"
about: Port strict-send and strict-receive path discovery with optional quote polling to Vue.
title: "feat(vue): add the usePaymentPaths composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue usePaymentPaths composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-17`

---

### Context

`usePaymentPaths` finds conversion paths for swaps. It supports `strictSend` and
`strictReceive` modes, optional `watch` polling to keep quotes fresh, and
returns a computed `rate`.

---

### Why this matters

Quotes feed `usePathPayment`’s `destMin` and `sendMax`. Any drift between
frameworks in path ranking or rate calculation changes what users pay.

---

### Where this lives

- New: `packages/vue/src/usePaymentPaths.ts`
- New: `packages/vue/src/usePaymentPaths.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept the strict-send or strict-receive options union plus `enabled`,
  `watch`, and `interval` as a static value, a Vue `ref`, or a getter
  (`MaybeRefOrGetter`), and resolve them with `toValue` inside the query key
  getter.
- Delegate data loading to `fetchPaymentPaths` from the React-free core and run
  it through the internal Vue `useQuery` adapter so the cache key is
  `paymentPathsKey` — identical to React.
- Return `paths`, `loading`, `error`, `lastUpdated`, and `refetch` as refs or
  computed values with the same field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Preserve the mode discriminated union in the Vue option types.
- Own the `watch` interval timer in the effect scope and stop it on disposal or
  when `enabled` is false.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] Both modes return the same paths and rates as React on fixtures
- [ ] Polling stops on disposal and when `watch` or `enabled` turns false
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/usePaymentPaths.ts`
- Shared fetcher: `fetchPaymentPaths` (`vue-17`)
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
