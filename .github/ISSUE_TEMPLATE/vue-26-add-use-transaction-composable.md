---
name: "Vue 26: Add the Vue useTransaction composable"
about: Port transaction lookup with watch-until-final polling to Vue.
title: "feat(vue): add the useTransaction composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useTransaction composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-13`

---

### Context

`useTransaction` fetches a transaction by hash and, with `watch: true`, keeps
polling until the status is final (`success` or `failed`). It is the natural
follow-up to a submitted payment.

---

### Why this matters

Polling that never stops wastes Horizon quota; polling that stops too early
shows users a stuck pending state. The stop condition must match React exactly.

---

### Where this lives

- New: `packages/vue/src/useTransaction.ts`
- New: `packages/vue/src/useTransaction.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `hash`, `watch`, and `staleTime` as a static value, a Vue `ref`, or a
  getter (`MaybeRefOrGetter`), and resolve them with `toValue` inside the query
  key getter.
- Delegate data loading to `fetchTransaction` from the React-free core and run
  it through the internal Vue `useQuery` adapter so the cache key is
  `transactionKey` — identical to React.
- Return `transaction`, `loading`, `error`, and `refetch` as refs or computed
  values with the same field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Implement `watch` with a timer owned by the composable’s effect scope; stop on
  final status, hash change, `watch` false, or disposal.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] Polling stops at `success` or `failed` and on scope disposal
- [ ] Changing the hash resets polling for the new transaction
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useTransaction.ts`
- Shared fetcher: `fetchTransaction` (`vue-13`)
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
