---
name: "Vue 27: Add the Vue useTransactionHistory composable"
about: Port paginated transaction history to Vue using the shared cursor model.
title: "feat(vue): add the useTransactionHistory composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useTransactionHistory composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-14`

---

### Context

`useTransactionHistory` lists an account’s transactions with cursor-based paging
and defaults to the connected wallet.

---

### Why this matters

Activity feeds are core wallet UI. Paging must behave identically to React,
including how `hasNext` is derived at the end of history.

---

### Where this lives

- New: `packages/vue/src/useTransactionHistory.ts`
- New: `packages/vue/src/useTransactionHistory.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `address`, `limit`, `order`, and `cursor` as a static value, a Vue
  `ref`, or a getter (`MaybeRefOrGetter`), and resolve them with `toValue`
  inside the query key getter.
- Delegate data loading to `fetchTransactionHistoryPage` from the React-free
  core and run it through the internal Vue `useQuery` adapter so the cache key
  is `transactionHistoryKey` — identical to React.
- Return `transactions`, `loading`, `error`, `refetch`, `fetchNext`,
  `fetchPrev`, `hasNext`, and `hasPrev` as refs or computed values with the same
  field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Hold the current cursor in the composable and derive each page key from it;
  paging uses the shared cursor helpers from `vue-14`.
- Reset to the first page when `address`, `limit`, or `order` changes.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] `fetchNext`/`fetchPrev` move one page and update `hasNext`/`hasPrev`
- [ ] Changing address resets paging to the first page
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useTransactionHistory.ts`
- Shared fetcher: `fetchTransactionHistoryPage` (`vue-14`)
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
