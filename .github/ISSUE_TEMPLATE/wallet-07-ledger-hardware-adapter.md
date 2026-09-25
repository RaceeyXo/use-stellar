---
name: "Wallets 07: Implement the Ledger hardware wallet adapter"
about: Add a Ledger adapter using the Stellar Ledger app over WebHID, attaching the device signature to the envelope.
title: "feat(wallets): add the Ledger wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the Ledger hardware wallet adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

Ledger devices sign Stellar transactions through the Stellar Ledger app
(`@ledgerhq/hw-app-str`) over a browser transport such as WebHID. Unlike
extensions, the device returns a raw signature over the transaction’s signature
base, not signed XDR.

---

### Why this matters

Hardware wallets are the standard for high-value accounts and treasury
operations. Supporting them makes use-stellar usable for custody-grade apps.

---

### Where this lives

- New: `packages/core/src/wallets/ledgerAdapter.ts`
- New: `packages/core/src/wallets/ledgerAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`

---

### Implementation guidelines

- Register the adapter under `metadata.type: "ledger"` with `supported: true`;
  once `rn-10` lands, also declare accurate `platforms` metadata.
- Default to the BIP-44 path `44'/148'/0'` with an option to select an account
  index.
- Build the signature base with the runtime passphrase, request the device
  signature, and attach it as a decorated signature to return signed XDR.
- Close the transport after each operation and map device-locked and
  app-not-open states to actionable errors.
- Mark `platforms` as web-only unless a native transport is provided.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("ledger")` returns the device’s public key for the selected path
- [ ] Signed XDR verifies against the public key and the runtime passphrase
- [ ] Locked device and closed Stellar app produce actionable errors
- [ ] The transport is closed after each call
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- Stellar Ledger app library: https://www.npmjs.com/package/@ledgerhq/hw-app-str

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
