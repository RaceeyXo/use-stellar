---
name: "Wallets 06: Implement a transport-agnostic WalletConnect v2 adapter"
about: Add a WalletConnect v2 adapter for the stellar namespace that works on web (QR/modal) and React Native.
title: "feat(wallets): add the WalletConnect wallet adapter"
labels: enhancement, wallets, framework-agnostic
---

## Implement a transport-agnostic WalletConnect v2 adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

Mobile wallets such as LOBSTR and Freighter Mobile sign through WalletConnect v2
using the `stellar` namespace, chains `stellar:pubnet` and `stellar:testnet`,
and methods `stellar_signXDR` and `stellar_signAndSubmitXDR`. use-stellar has no
WalletConnect support.

Build a core adapter that owns the session logic but receives its UI (QR modal
or deep link) and storage from the host platform, so web and React Native
(`rn-11`) share it.

---

### Why this matters

WalletConnect is how desktop web apps reach mobile wallets and the only
practical signing path for native apps. One shared adapter avoids two divergent
session implementations.

---

### Where this lives

- New: `packages/core/src/wallets/walletConnectAdapter.ts`
- New: `packages/core/src/wallets/walletConnectAdapter.test.ts`
- Update: `packages/core/src/wallets/registry.ts`
- Update: `packages/core/src/wallets/index.ts`

---

### Implementation guidelines

- Register the adapter under `metadata.type: "walletconnect"` with `supported:
true`; once `rn-10` lands, also declare accurate `platforms` metadata.
- Export `createWalletConnectAdapter({ projectId, metadata, storage,
onDisplayUri })`; the app registers it with `registerWalletAdapter`.
- Map `testnet` → `stellar:testnet` and `mainnet` → `stellar:pubnet`; reject
  `futurenet` and `custom` unless the session’s approved chains include them.
- Use `stellar_signXDR` for `signTransaction`; do not submit through the wallet
  so hooks keep ownership of submission and error mapping.
- Implement `canAutoConnect` from an existing valid session and `subscribe` from
  session update and delete events.
- Keep WalletConnect packages as optional peers.
- Load the vendor SDK lazily inside `connect`/`signTransaction` so it never
  enters SSR or unrelated bundles (`wallet-10`).
- Map vendor errors to `WalletAdapterError` codes: user rejection →
  `wallet_access_rejected`, missing wallet → `wallet_unavailable`, wrong network
  → `wallet_network_mismatch`, signing failure → `wallet_sign_failed`.
- Sign only with the passphrase passed in `SignTransactionOptions`; never infer
  or default a network.

---

### Acceptance criteria

- [ ] Pairing with a mocked sign client returns the approved account
- [ ] The requested chain matches the runtime network
- [ ] Session deletion from the wallet disconnects through `subscribe`
- [ ] Apps without WalletConnect configured do not load its packages
- [ ] The adapter passes the shared conformance suite from `wallet-01`
- [ ] Vendor errors map to the correct `WalletAdapterError` codes
- [ ] The vendor SDK is not loaded during SSR or at module import
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm size` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Reference implementations: `packages/core/src/wallets/freighterAdapter.ts`, `albedoAdapter.ts`
- WalletConnect Stellar RPC: https://docs.walletconnect.com/advanced/multichain/rpc-reference/stellar-rpc
- Native wiring: `rn-11`
- Session persistence: `wallet-11`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Implement only the existing `WalletAdapter` contract; do not add
  wallet-specific branches to hooks, composables, or the runtime.
- Confirm the vendor’s current API from its official documentation before
  implementing, and link the version you used in the PR.
- Never ship a shared WalletConnect `projectId`.
- Mock the wallet SDK or injected provider in tests; never require a real
  extension, device, or funded account.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
