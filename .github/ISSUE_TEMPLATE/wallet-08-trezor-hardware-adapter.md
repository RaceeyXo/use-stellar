---
name: "Wallets 08: Implement the Trezor hardware wallet adapter"
about: Add a Trezor adapter using Trezor Connect’s Stellar methods and attach the returned signature to the envelope.
title: "feat(wallets): add the Trezor wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the Trezor hardware wallet adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

Trezor Connect exposes Stellar address and signing methods. Trezor expects the
transaction in its own parameter format (produced by Trezor’s Stellar transform
plugin) and returns a signature that must be attached to the envelope.

---

### Why this matters

Trezor is the second major hardware wallet. Supporting both Ledger and Trezor
through the same contract proves the adapter model handles signature-returning
devices.

---

### Where this lives

- New: `packages/core/src/wallets/trezorAdapter.ts`
- New: `packages/core/src/wallets/trezorAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`

---

### Implementation guidelines

- Register the adapter under `metadata.type: "trezor"` with `supported: true`;
  once `rn-10` lands, also declare accurate `platforms` metadata.
- Require the app to supply Trezor Connect manifest details (email, app URL);
  never ship defaults.
- Transform the transaction with Trezor’s Stellar plugin, pass the runtime
  passphrase, and attach the returned signature.
- Default to path `m/44'/148'/0'` with an account-index option.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("trezor")` returns the device address for the selected path
- [ ] Signed XDR verifies against the public key and passphrase
- [ ] User cancellation maps to `wallet_access_rejected`
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- Trezor Connect Stellar methods: https://connect.trezor.io/9/methods/stellar/

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Implement only the existing `WalletAdapter` contract; do not add
  wallet-specific branches to hooks, composables, or the runtime.
- Confirm the vendor’s current API from its official documentation before
  implementing, and link the version you used in the PR.
- Never request or handle seed phrases or private keys.
- Mock the wallet SDK or injected provider in tests; never require a real
  extension, device, or funded account.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
