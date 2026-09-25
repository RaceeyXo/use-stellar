---
name: "React Native 15: Verify account and asset read hooks on React Native"
about: Prove balance, account, existence, asset, network, federation, and claimable-balance hooks work on RN.
title: "test(react-native): verify account and asset read hooks on RN"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify account and asset read hooks on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-14`

---

### Context

The simplest hooks — single Horizon reads through the shared cache — are the
first proof that core is platform-safe on RN. They also exercise
`Horizon.Server` construction, URL handling, and the SDK’s HTTP client under
Hermes.

---

### Why this matters

If these fail on RN, every other mobile feature fails. They are the baseline for
the platform claim in the README.

---

### Where this lives

- New: `packages/react-native/src/__tests__/useBalance.native.test.tsx`
- New: `packages/react-native/src/__tests__/useAccount.native.test.tsx`
- New: `packages/react-native/src/__tests__/useAccountExists.native.test.tsx`
- New: `packages/react-native/src/__tests__/useAsset.native.test.tsx`
- New: `packages/react-native/src/__tests__/useNetwork.native.test.tsx`
- New: `packages/react-native/src/__tests__/useFederationLookup.native.test.tsx`
- New: `packages/react-native/src/__tests__/useClaimableBalance.native.test.tsx`
- Update: `packages/core/src/` only at the owner layer of any platform defect found
- Update: `packages/react-native/src/index.ts` (re-exports)

---

### Implementation guidelines

- Render `useBalance`, `useAccount`, `useAccountExists`, `useAsset`,
  `useNetwork`, `useFederationLookup`, `useClaimableBalance` inside the RN
  `StellarProvider` with `@testing-library/react-native` and the RN harness from
  `rn-14`.
- Assert cache sharing between `useBalance` and `useAccount` for the same
  address on RN.
- Cover a custom `http://` Horizon URL to confirm `allowHttp` works on RN
  networking.
- If a hook fails on RN, fix the root cause in core (runtime, fetcher, or
  utility) rather than adding an RN-only branch.
- Re-export the hooks from `@use-stellar/react-native` so apps depend on one
  package.

---

### Acceptance criteria

- [ ] Each hook returns the expected data for mocked Horizon responses
- [ ] Shared account cache works on RN
- [ ] `allowHttp` works for a local custom network
- [ ] Hook return shapes are identical to the web build
- [ ] No `window`, `document`, or `react-dom` access occurs
- [ ] RN package tests, typecheck, and core tests pass

---

### Reference

- Hooks: `packages/core/src/hooks/`
- Harness: `rn-14`

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
