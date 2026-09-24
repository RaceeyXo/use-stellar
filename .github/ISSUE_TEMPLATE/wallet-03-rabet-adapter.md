---
name: "Wallets 03: Implement the Rabet wallet adapter"
about: Replace the unsupported Rabet stub with an adapter over the injected window.rabet provider.
title: "feat(wallets): add the Rabet wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the Rabet wallet adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

`rabet` is another stub in `registry.ts`. Rabet injects a `window.rabet`
provider with connect and sign methods and emits account and network change
events.

---

### Why this matters

Every stub in the registry is a promise the library does not keep. Rabet’s
change events also exercise the `subscribe` contract, which only Freighter
implements today.

---

### Where this lives

- New: `packages/core/src/wallets/rabetAdapter.ts`
- New: `packages/core/src/wallets/rabetAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`

---

### Implementation guidelines

- Register the adapter under `metadata.type: "rabet"` with `supported: true`;
  once `rn-10` lands, also declare accurate `platforms` metadata.
- Detect availability from the injected provider without throwing when it is
  absent.
- Translate the runtime network to Rabet’s network identifiers; reject `custom`
  networks Rabet cannot sign for.
- Implement `subscribe` over Rabet’s account and network change events and
  return a working unsubscribe.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("rabet")` returns the injected account
- [ ] Account and network change events reach `useWallet` through `subscribe`
- [ ] The unsupported stub is removed from the registry
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- Rabet developer docs: https://docs.rabet.io

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Implement only the existing `WalletAdapter` contract; do not add
  wallet-specific branches to hooks, composables, or the runtime.
- Confirm the vendor’s current API from its official documentation before
  implementing, and link the version you used in the PR.
- Mock the wallet SDK or injected provider in tests; never require a real
  extension, device, or funded account.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
