---
name: "React Native 11: Connect mobile wallets on React Native through WalletConnect"
about: Wire the core WalletConnect adapter into React Native with native storage, deep links to wallet apps, and QR fallback.
title: "feat(react-native): connect LOBSTR and other mobile wallets via WalletConnect"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Connect mobile wallets on React Native through WalletConnect

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-07`, `wallet-06`

---

### Context

Mobile Stellar wallets such as LOBSTR expose WalletConnect v2 with the `stellar`
namespace (`stellar:pubnet`, `stellar:testnet`) and methods `stellar_signXDR`
and `stellar_signAndSubmitXDR`. `wallet-06` adds a transport-agnostic
WalletConnect adapter in core; RN needs the native wiring.

---

### Why this matters

WalletConnect is the only broadly supported way for a native app to request
signatures from a separate wallet app. Without it, RN users can read data but
cannot sign.

---

### Where this lives

- New: `packages/react-native/src/wallets/walletConnect.ts`
- New: `packages/react-native/src/wallets/walletConnect.test.ts`
- Update: `packages/react-native/src/StellarProvider.tsx` (optional `walletConnect` config)
- Update: `packages/react-native/package.json` (optional WalletConnect peers)

---

### Implementation guidelines

- Register the core WalletConnect adapter with RN-compatible storage and crypto
  (`@walletconnect/react-native-compat`).
- Open the chosen wallet via its universal link or deep link; expose the pairing
  URI so apps can show a QR code as a fallback.
- Map the runtime network to the correct `stellar:*` chain and reject `custom`
  networks the wallet cannot sign for.
- Require the app to supply its own WalletConnect `projectId`; never ship a
  default.

---

### Acceptance criteria

- [ ] `connect("walletconnect")` pairs with a mocked wallet and returns the address
- [ ] Signing uses `stellar_signXDR` for the runtime network’s chain
- [ ] User rejection maps to `wallet_access_rejected`
- [ ] The pairing URI is available for QR display
- [ ] No WalletConnect code is bundled for apps that do not configure it

---

### Reference

- Core adapter: `wallet-06`
- Stellar WalletConnect namespace: https://docs.walletconnect.com/advanced/multichain/rpc-reference/stellar-rpc
- Native provider: `rn-07`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Never ship a shared WalletConnect `projectId`.
- Mock Horizon, Soroban RPC, wallets, and native modules in tests; make no live
  network calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
