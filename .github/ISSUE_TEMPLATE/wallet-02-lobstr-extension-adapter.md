---
name: "Wallets 02: Implement the LOBSTR signer extension adapter"
about: Replace the unsupported LOBSTR stub with a real adapter built on @lobstrco/signer-extension-api.
title: "feat(wallets): add the LOBSTR wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement the LOBSTR signer extension adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

`registry.ts` registers `lobstr` through `createUnsupportedAdapter`, yet
`@lobstrco/signer-extension-api` already ships in core’s `dependencies`
(`pkg-02`). Users see LOBSTR in the wallet list but cannot connect.

The LOBSTR signer extension exposes connection checks, public-key retrieval, and
transaction signing. Implement the adapter on top of it.

---

### Why this matters

LOBSTR is one of the most widely used Stellar wallets. Shipping its dependency
without a working adapter costs every user bundle size for nothing.

---

### Where this lives

- New: `packages/core/src/wallets/lobstrAdapter.ts`
- New: `packages/core/src/wallets/lobstrAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`

---

### Implementation guidelines

- Register the adapter under `metadata.type: "lobstr"` with `supported: true`;
  once `rn-10` lands, also declare accurate `platforms` metadata.
- Implement `isAvailable`, `connect`, `getNetworkDetails`, and `signTransaction`
  using the extension API.
- If the extension cannot report or sign for a network, reject unsupported
  networks with `wallet_network_mismatch` instead of signing.
- Omit `subscribe` and `canAutoConnect` unless the extension genuinely supports
  them.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] `connect("lobstr")` returns the extension’s public key on a supported network
- [ ] Unsupported networks are rejected before any signing prompt
- [ ] The unsupported stub is removed from the registry
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- Unused dependency: `pkg-02`
- LOBSTR signer extension API: https://www.npmjs.com/package/@lobstrco/signer-extension-api

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
