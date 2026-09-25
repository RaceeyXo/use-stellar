---
name: "Wallets 05: Implement the Hana wallet adapter"
about: Add an adapter for the Hana browser wallet via its injected Stellar provider.
title: "feat(wallets): add the Hana wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the Hana wallet adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

Hana is a multichain browser wallet with Stellar support through an injected
provider. It is not registered in use-stellar.

---

### Why this matters

Supporting multichain wallets widens the audience that can connect without
installing a Stellar-only extension.

---

### Where this lives

- New: `packages/core/src/wallets/hanaAdapter.ts`
- New: `packages/core/src/wallets/hanaAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`
- Update: `packages/core/src/types/index.ts` (`WalletType`)

---

### Implementation guidelines

- Register the adapter under `metadata.type: "hana"` with `supported: true`;
  once `rn-10` lands, also declare accurate `platforms` metadata.
- Detect the injected Stellar provider without throwing when absent.
- Pass the account to sign with and the passphrase explicitly on every sign
  request.
- Add `hana` to the `WalletType` autocomplete union.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("hana")` returns the approved Stellar account
- [ ] Signing passes the runtime passphrase and account
- [ ] `hana` appears in `WalletType` autocomplete
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- Hana wallet: https://hanawallet.io

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
