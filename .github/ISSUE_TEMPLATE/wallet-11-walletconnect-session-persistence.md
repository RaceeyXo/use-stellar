---
name: "Wallets 11: Integrate WalletConnect sessions with autoConnect and change events"
about: Make WalletConnect sessions restore silently through autoConnect and report account and chain changes through subscribe.
title: "feat(wallets): integrate WalletConnect sessions with autoConnect and subscribe"
labels: enhancement, wallets, framework-agnostic
---

## Integrate WalletConnect sessions with autoConnect and change events

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-06`, `rn-02`

---

### Context

WalletConnect persists its own sessions, while use-stellar persists a separate
wallet session for autoConnect. Without integration they disagree: the app
thinks it is disconnected while the wallet still holds a live session, or the
reverse.

---

### Why this matters

Two sources of truth for one connection is the root cause of ‘ghost connected’
and ‘reconnect prompt every time’ bugs. The WalletConnect session must be
authoritative and use-stellar’s session must reflect it.

---

### Where this lives

- Update: `packages/core/src/wallets/walletConnectAdapter.ts`
- Update: `packages/core/src/runtime/walletSession.ts`
- New: `packages/core/src/wallets/walletConnectAdapter.session.test.ts`

---

### Implementation guidelines

- `canAutoConnect` returns true only when a valid, unexpired session includes
  the runtime chain.
- On `disconnect`, end the WalletConnect session and clear the stored
  use-stellar session.
- Report account and chain changes from session updates through `subscribe`.
- Use the platform storage adapter so web and RN behave the same.

---

### Acceptance criteria

- [ ] A valid session reconnects silently on startup
- [ ] An expired or wrong-chain session restores intent only
- [ ] Wallet-side disconnect clears app state
- [ ] Disconnecting in the app ends the WalletConnect session

---

### Reference

- WalletConnect adapter: `wallet-06`
- Async session storage: `rn-02`
- Autoconnect design: `hook-use-wallet-autoconnect-and-adapters`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Implement only the existing `WalletAdapter` contract; do not add
  wallet-specific branches to hooks, composables, or the runtime.
- Mock the wallet SDK or injected provider in tests; never require a real
  extension, device, or funded account.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
