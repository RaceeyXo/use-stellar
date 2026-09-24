---
name: "Vue 30: Add the Vue useTrades composable"
about: Port paginated DEX and liquidity-pool trade history to Vue using the shared normalizer.
title: "feat(vue): add the useTrades composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useTrades composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-14`

---

### Context

`useTrades` lists orderbook and liquidity-pool trades for an account or an asset
pair, normalized to `NormalizedTrade` with price, `priceR`, and side.

---

### Why this matters

Trade side and price are easy to invert. Reusing the shared normalizer keeps Vue
trading views consistent with React.

---

### Where this lives

- New: `packages/vue/src/useTrades.ts`
- New: `packages/vue/src/useTrades.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `address`, `baseAsset`, `counterAsset`, `limit`, and `order` as a
  static value, a Vue `ref`, or a getter (`MaybeRefOrGetter`), and resolve them
  with `toValue` inside the query key getter.
- Delegate data loading to `fetchTradesPage` from the React-free core and run it
  through the internal Vue `useQuery` adapter so the cache key is `tradesKey` —
  identical to React.
- Return `trades`, `loading`, `error`, `hasNext`, `hasPrev`, `fetchNext`,
  `fetchPrev`, and `refetch` as refs or computed values with the same field
  names and semantics as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Serialize asset inputs with the shared asset-key helper so equivalent asset
  objects hit the same cache entry.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] `side`, `price`, and `baseIsSeller` match React on shared fixtures
- [ ] Equivalent asset objects produce the same cache key
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useTrades.ts`
- Shared fetcher: `fetchTradesPage` (`vue-14`)
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
