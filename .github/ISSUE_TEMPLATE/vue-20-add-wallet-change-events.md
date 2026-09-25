---
name: "Vue 20: Add wallet change events and network mismatch to Vue useWallet"
about: Subscribe to adapter account/network changes and expose refreshWalletNetwork and isNetworkMismatch in the Vue wallet composable.
title: "feat(vue): add wallet change subscription and network mismatch state"
labels: enhancement, vue, framework-agnostic
---

## Add wallet change events and network mismatch to Vue useWallet

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-08`

---

### Context

While connected, React’s `useWallet` subscribes through `adapter.subscribe` so
account or network switches inside the extension update `address`,
`walletNetwork`, and `walletNetworkPassphrase`. It also exposes
`refreshWalletNetwork()` and a derived `isNetworkMismatch`.

Port these to Vue so apps can block signing when the wallet is on the wrong
network.

---

### Why this matters

The mismatch flag is the only guard between a user and a signature bound to the
wrong network (`bug-08`). Vue users need the same guard with the same semantics.

---

### Where this lives

- Update: `packages/vue/src/useWallet.ts`
- New: `packages/vue/src/useWallet.events.test.ts`

---

### Implementation guidelines

- Own the adapter subscription at the runtime level so N composables do not
  create N extension watchers.
- Subscribe only while connected and unsubscribe on disconnect, wallet change,
  and scope disposal.
- Ignore change events that arrive after disconnect.
- Compute `isNetworkMismatch` exactly as React does.

---

### Acceptance criteria

- [ ] Account and network changes from a fake adapter update state reactively
- [ ] Only one adapter subscription exists regardless of consumer count
- [ ] Late events after disconnect are ignored
- [ ] `refreshWalletNetwork` updates `walletNetwork` and surfaces adapter errors
- [ ] `isNetworkMismatch` matches React for connected, disconnected, and custom networks
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useWallet.ts` (change events)
- Adapter contract: `packages/core/src/wallets/types.ts`
- Mismatch guard: `bug-08`

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
