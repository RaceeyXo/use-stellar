---
name: "Vue 36: Add the Vue useAddTrustline composable"
about: Port trustline creation to Vue using the shared addTrustline action.
title: "feat(vue): add the useAddTrustline composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useAddTrustline composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-08`, `vue-15`

---

### Context

`useAddTrustline` submits a `changeTrust` operation for an issued asset with an
optional limit, signs through the wallet, and invalidates the account cache so
balances show the new line.

---

### Why this matters

A trustline is required before receiving any issued asset. Vue apps need the
same validation of asset code, issuer, and limit that React applies.

---

### Where this lives

- New: `packages/vue/src/useAddTrustline.ts`
- New: `packages/vue/src/useAddTrustline.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Expose `addTrustline(options: AddTrustlineOptions)`, `loading`, `error`,
  `result`, and `reset` with the same semantics as the React hook.
- Delegate building, fee resolution, signing, submission, and cache invalidation
  to `addTrustline` from the core actions module (`vue-15`); pass the installed
  runtime so the network passphrase and connected wallet come from one source.
- Guard against stale completions: a result from an older call must not
  overwrite state from a newer call or a `reset()`.
- Do not mutate state after the owning effect scope is disposed.

---

### Acceptance criteria

- [ ] `addTrustline` builds, signs through the adapter, and submits using the runtime network passphrase
- [ ] `loading` is true only while a call is in flight and never sticks after an error
- [ ] Wallet-not-connected and validation failures reject with the same `StellarError` codes as React
- [ ] The connected account’s balance cache entry is invalidated after success
- [ ] A stale completion cannot overwrite a newer call or a `reset()`
- [ ] An optional `limit` is encoded exactly as React encodes it
- [ ] Tests use a fake adapter and mocked Horizon; no real wallet or network
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useAddTrustline.ts`
- Shared submission services: `vue-15`
- Fee policy: `packages/core/src/utils/fees.ts`
- Error model: `packages/core/src/errors/`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Never sign against a passphrase other than the runtime’s resolved
  `networkPassphrase`.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
