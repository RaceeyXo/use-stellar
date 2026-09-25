---
name: "Vue 25: Add the Vue useClaimableBalance composable"
about: Port the claimable-balance list read to Vue on the shared fetcher and cache.
title: "feat(vue): add the useClaimableBalance composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useClaimableBalance composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-13`

---

### Context

`useClaimableBalance` lists claimable balances where an account is a claimant,
including asset, amount, claimants with predicates, and sponsor.

---

### Why this matters

Airdrops and pending transfers surface as claimable balances; Vue wallets need
the same normalized list React users get.

---

### Where this lives

- New: `packages/vue/src/useClaimableBalance.ts`
- New: `packages/vue/src/useClaimableBalance.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `address` (defaulting to the connected wallet) and `staleTime` as a
  static value, a Vue `ref`, or a getter (`MaybeRefOrGetter`), and resolve them
  with `toValue` inside the query key getter.
- Delegate data loading to `fetchClaimableBalances` from the React-free core and
  run it through the internal Vue `useQuery` adapter so the cache key is
  `claimableBalanceKey` — identical to React.
- Return `balances`, `loading`, `error`, and `refetch` as refs or computed
  values with the same field names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Default the address to the runtime wallet address and react to
  connect/disconnect.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] Predicates and sponsor fields are passed through unchanged
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useClaimableBalance.ts`
- Shared fetcher: `fetchClaimableBalances` (`vue-13`)
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
