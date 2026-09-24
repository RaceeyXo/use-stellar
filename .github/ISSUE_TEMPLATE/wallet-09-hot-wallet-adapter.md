---
name: "Wallets 09: Implement the HOT Wallet adapter"
about: Add an adapter for HOT Wallet’s Stellar support via its official SDK.
title: "feat(wallets): add the HOT Wallet wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the HOT Wallet adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

HOT Wallet is a multichain wallet with Stellar support and an official
JavaScript SDK. It is not registered in use-stellar.

---

### Why this matters

HOT Wallet reaches users on Telegram and mobile. A standard adapter lets
use-stellar apps accept them with no hook changes.

---

### Where this lives

- New: `packages/core/src/wallets/hotWalletAdapter.ts`
- New: `packages/core/src/wallets/hotWalletAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`
- Update: `packages/core/src/types/index.ts` (`WalletType`)

---

### Implementation guidelines

- Register the adapter under `metadata.type: "hot"` with `supported: true`; once
  `rn-10` lands, also declare accurate `platforms` metadata.
- Use the official SDK’s Stellar address and sign requests; pass the passphrase
  explicitly.
- Add `hot` to the `WalletType` autocomplete union.
- Declare accurate `platforms` metadata based on where the SDK runs.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("hot")` returns the approved Stellar account
- [ ] Signing passes the runtime passphrase
- [ ] `hot` appears in `WalletType` autocomplete
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- HOT Wallet SDK: https://www.npmjs.com/package/@hot-wallet/sdk

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
