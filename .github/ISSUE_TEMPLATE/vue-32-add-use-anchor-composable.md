---
name: "Vue 32: Add the Vue useAnchor composable"
about: Port SEP-1 stellar.toml resolution to Vue with abort-on-change and the shared anchor fetcher.
title: "feat(vue): add the useAnchor composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useAnchor composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-07`, `vue-17`

---

### Context

`useAnchor` resolves an anchor’s `stellar.toml` from a home domain and returns
signing key, web-auth endpoint, transfer servers, KYC server, and currencies. It
aborts the previous request when the domain changes and supports `autoFetch:
false`.

---

### Why this matters

Anchor endpoints drive deposit and withdrawal flows. A stale response for the
previous domain must never overwrite the current one.

---

### Where this lives

- New: `packages/vue/src/useAnchor.ts`
- New: `packages/vue/src/useAnchor.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Call `fetchAnchorInfo` from `vue-17` with an `AbortController` owned by the
  composable.
- Abort on domain change and scope disposal; ignore late results.
- Honour `autoFetch: false` and expose `refetch`.
- Return `anchor`, `loading`, `error`, and `refetch` with React semantics.

---

### Acceptance criteria

- [ ] Resolves a mocked `stellar.toml` into the same `AnchorInfo` as React
- [ ] A domain change aborts the previous request and ignores its result
- [ ] `autoFetch: false` makes no request until `refetch()`
- [ ] Timeouts and malformed TOML surface as `StellarError`s
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useAnchor.ts`
- Shared fetcher: `vue-17`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
