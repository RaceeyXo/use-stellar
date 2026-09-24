---
name: "Wallets 12: Document all wallet adapters and add a demo connect picker"
about: Update the wallets guide with a support matrix and setup for every adapter, and add a multi-wallet picker to the demos.
title: "docs(wallets): document every adapter and add a demo wallet picker"
labels: enhancement, wallets, framework-agnostic, documentation, demo
---

## Document all wallet adapters and add a demo connect picker

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-02`, `wallet-06`, `wallet-07`

---

### Context

`docs/guides/wallets.md` and the demo only cover Freighter and Albedo. With new
adapters, users need a single place explaining setup, optional peers, supported
networks, and platform availability for each wallet.

---

### Why this matters

Wallet support that is not documented is invisible. A picker in the demo also
doubles as a manual test bed for every adapter.

---

### Where this lives

- Update: `docs/guides/wallets.md`
- Update: `docs/hooks/use-wallet.md` (supported wallet types)
- Update: `packages/demo/components/` (wallet picker)
- Update: `packages/vue-demo/` wallet section (if `vue-40` has landed)

---

### Implementation guidelines

- Add a matrix: wallet, type string, platforms, networks, optional peer,
  supports autoConnect, supports change events.
- Show per-adapter setup, including required app-supplied config for
  WalletConnect and Trezor.
- Build the demo picker from `getWalletAdapters()` metadata; hide adapters that
  report unavailable.
- Keep all examples on testnet.

---

### Acceptance criteria

- [ ] Every registered adapter is documented with setup steps
- [ ] The matrix matches adapter metadata
- [ ] The demo picker lists only available adapters and connects through `useWallet`
- [ ] Demo build and typecheck pass

---

### Reference

- Wallet guide: `docs/guides/wallets.md`
- Adapters: `wallet-02` to `wallet-09`
- Demo: `packages/demo`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not add wallet-specific logic to the demo beyond reading adapter metadata.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
