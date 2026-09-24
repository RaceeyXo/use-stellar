---
name: "Vue 33: Add the Vue useSorobanContract composable"
about: Port read-only Soroban contract simulation to Vue with the shared args-key and decoding.
title: "feat(vue): add the useSorobanContract composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useSorobanContract composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-12`, `vue-16`

---

### Context

`useSorobanContract` simulates a read-only contract call against Soroban RPC,
maps arguments through an optional `ContractSpecLike`, decodes results, and
caches under `sorobanContractKey` using a serialized `argsKey`.

---

### Why this matters

Reactive `args` are the main hazard in Vue: deep proxies around `xdr.ScVal`
objects can break identity and serialization. The composable must key on the
shared args serializer, not object identity.

---

### Where this lives

- New: `packages/vue/src/useSorobanContract.ts`
- New: `packages/vue/src/useSorobanContract.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Accept `contractId`, `method`, `args`, `spec`, and `sourceAccount` as a static
  value, a Vue `ref`, or a getter (`MaybeRefOrGetter`), and resolve them with
  `toValue` inside the query key getter.
- Delegate data loading to `simulateContractCall` from the React-free core and
  run it through the internal Vue `useQuery` adapter so the cache key is
  `sorobanContractKey` — identical to React.
- Return `data`, `loading`, `error`, and `refetch`, generic over the decoded
  result type as refs or computed values with the same field names and semantics
  as the React hook.
- Treat a `null` or empty input as idle: no request, no error, `loading` false.
- Unwrap reactive args with `toRaw` before serialization; never pass Vue proxies
  into the Stellar SDK.
- Keep the result generic: `useSorobanContract<T>()`.

---

### Acceptance criteria

- [ ] Static, ref, and getter inputs all produce the expected data
- [ ] Changing a reactive input unsubscribes from the old key and loads the new one
- [ ] A React hook and a Vue composable with the same input share one cache entry
- [ ] Idle inputs make no request and report no error
- [ ] Errors surface as `StellarError` with the same codes as the React hook
- [ ] Reactive `ScVal` arguments serialize to the same `argsKey` as React
- [ ] Invalid contract IDs fail with the same error message without a request
- [ ] Effect-scope disposal removes the store subscription
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useSorobanContract.ts`
- Shared fetcher: `simulateContractCall` (`vue-16`)
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
