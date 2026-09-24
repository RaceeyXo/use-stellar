---
name: "Wallets 04: Implement the xBull wallet adapter"
about: Add an adapter for xBull (extension and PWA) using its official connect SDK.
title: "feat(wallets): add the xBull wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the xBull wallet adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

xBull is a popular Stellar wallet available as a browser extension and a PWA,
with an official connect SDK (`@creit.tech/xbull-wallet-connect`). It is not
registered in use-stellar at all.

---

### Why this matters

xBull is widely used by Soroban developers. Supporting it through the adapter
registry lets every framework adapter offer it with no hook changes.

---

### Where this lives

- New: `packages/core/src/wallets/xbullAdapter.ts`
- New: `packages/core/src/wallets/xbullAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`
- Update: `packages/core/src/types/index.ts` (`WalletType`)

---

### Implementation guidelines

- Register the adapter under `metadata.type: "xbull"` with `supported: true`;
  once `rn-10` lands, also declare accurate `platforms` metadata.
- Use the official SDK’s connect and sign flow; pass the network passphrase
  explicitly on sign.
- Add `xbull` to the `WalletType` autocomplete union.
- Implement `resolveNetwork` only if the SDK reports the current network without
  prompting.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("xbull")` returns the approved account
- [ ] Signing passes the runtime passphrase and returns signed XDR
- [ ] `xbull` appears in `WalletType` autocomplete
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- xBull connect SDK: https://www.npmjs.com/package/@creit.tech/xbull-wallet-connect

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
