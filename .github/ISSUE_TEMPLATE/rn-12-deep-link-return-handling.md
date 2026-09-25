---
name: "React Native 12: Handle deep-link returns and session resume after signing"
about: Resume WalletConnect requests and wallet state correctly when the user returns from the wallet app, including cold starts.
title: "feat(react-native): handle deep-link returns and resume pending wallet requests"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Handle deep-link returns and session resume after signing

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-11`

---

### Context

On mobile, signing sends the user to another app. When they come back, the
originating app may have been backgrounded or killed. Pending sign requests must
resolve or fail deterministically, and the connected session must be restored
without prompting again.

---

### Why this matters

A signing promise that never resolves after an app switch leaves `loading` stuck
forever — the mobile version of `state-01`. Users then retry and risk double
submission.

---

### Where this lives

- New: `packages/react-native/src/wallets/linking.ts`
- New: `packages/react-native/src/wallets/linking.test.ts`
- Update: `packages/react-native/src/wallets/walletConnect.ts`

---

### Implementation guidelines

- Listen to `Linking` URL events and the initial URL; route only URLs matching
  the app-configured redirect scheme.
- On foreground, reconcile pending WalletConnect requests: resolve completed
  ones, time out stale ones with a clear error.
- Restore an existing WalletConnect session on cold start via `canAutoConnect`
  without prompting.
- Ignore and log unexpected URLs; never act on unvalidated link parameters.

---

### Acceptance criteria

- [ ] Returning from the wallet resolves the pending request
- [ ] A request abandoned in the wallet times out with a `StellarError` and clears `loading`
- [ ] Cold start restores the session silently when possible
- [ ] Unrecognised deep links are ignored

---

### Reference

- WalletConnect RN integration: `rn-11`
- Stuck loading precedent: `state-01`
- Autoconnect semantics: `hook-use-wallet-autoconnect-and-adapters`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Treat every incoming URL as untrusted input.
- Mock Horizon, Soroban RPC, wallets, and native modules in tests; make no live
  network calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
