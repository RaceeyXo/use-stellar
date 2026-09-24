---
name: "React Native 18: Verify payment, trustline, and path-payment hooks on React Native"
about: Prove write hooks sign through the WalletConnect adapter and submit correctly on RN.
title: "test(react-native): verify write hooks with a WalletConnect signer"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify payment, trustline, and path-payment hooks on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-11`, `rn-13`, `rn-14`

---

### Context

Write hooks build XDR, sign via the adapter, and submit. On RN the signer is the
WalletConnect adapter and signing involves an app switch, so timing, error
mapping, and `loading` state need native-specific verification.

---

### Why this matters

These hooks move funds. They must produce the same XDR as on web and must never
leave `loading` stuck or resubmit after an app switch.

---

### Where this lives

- New: `packages/react-native/src/__tests__/useSendPayment.native.test.tsx`
- New: `packages/react-native/src/__tests__/useAddTrustline.native.test.tsx`
- New: `packages/react-native/src/__tests__/usePathPayment.native.test.tsx`
- Update: `packages/core/src/` only at the owner layer of any platform defect found
- Update: `packages/react-native/src/index.ts` (re-exports)

---

### Implementation guidelines

- Render `useSendPayment`, `useAddTrustline`, `usePathPayment` inside the RN
  `StellarProvider` with `@testing-library/react-native` and the RN harness from
  `rn-14`.
- Use the mocked WalletConnect signer from the harness; assert `stellar_signXDR`
  is called with the runtime chain.
- Simulate background/foreground during signing and assert the promise settles.
- If a hook fails on RN, fix the root cause in core (runtime, fetcher, or
  utility) rather than adding an RN-only branch.
- Re-export the hooks from `@use-stellar/react-native` so apps depend on one
  package.

---

### Acceptance criteria

- [ ] Signed XDR matches the web build for the same inputs
- [ ] Wallet rejection maps to `wallet_access_rejected` and clears `loading`
- [ ] Expiry maps to the error introduced in `rn-13`
- [ ] Hook return shapes are identical to the web build
- [ ] No `window`, `document`, or `react-dom` access occurs
- [ ] RN package tests, typecheck, and core tests pass

---

### Reference

- Shared actions: `vue-15`
- WalletConnect RN: `rn-11`
- Expiry handling: `rn-13`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- React Native reuses the React hooks from `use-stellar`; do not fork or
  re-implement a hook inside `packages/react-native`.
- Mock Horizon, Soroban RPC, wallets, and native modules in tests; make no live
  network calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
