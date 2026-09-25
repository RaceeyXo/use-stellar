---
name: "Vue 13: Extract framework-neutral Horizon read fetchers"
about: Move the Horizon request and normalization logic for account, balance, asset, claimable balance, federation, and transaction reads out of React hooks.
title: "refactor(core): extract Horizon read fetchers into a React-free queries module"
labels: enhancement, vue, framework-agnostic, refactor
---

## Extract framework-neutral Horizon read fetchers

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-04`

---

### Context

Read hooks such as `useAccount`, `useAccountExists`, `useAsset`,
`useClaimableBalance`, `useFederationLookup`, and `useTransaction` each build
their Horizon request and normalize the response inline inside the hook body.

Vue needs the same requests and the same normalized shapes. Extract each into a
pure `fetchX(networkConfig, params, { signal })` function in a new `queries`
module, and have the React hooks call them.

---

### Why this matters

Normalization is the contract users code against — `Balance`, `AccountInfo`,
`AccountExistsReason`, `TransactionStatus`. If Vue copies it, a fix to one
framework (for example a 404 mapped to `not_funded`) will not reach the other.

---

### Where this lives

- New: `packages/core/src/queries/account.ts` (account, balances, account-exists)
- New: `packages/core/src/queries/asset.ts`
- New: `packages/core/src/queries/claimableBalance.ts`
- New: `packages/core/src/queries/federation.ts`
- New: `packages/core/src/queries/transaction.ts`
- New: `packages/core/src/queries/*.test.ts`
- Update: the matching hooks in `packages/core/src/hooks/`
- Update: `packages/core/src/core.ts`

---

### Implementation guidelines

- Each fetcher takes the resolved `NetworkConfig`, its parameters, and an
  optional `AbortSignal`, and returns the exact normalized type the hook returns
  today.
- Export a matching key builder alongside each fetcher (reuse `cache/keys.ts`;
  do not invent new keys).
- Map errors through `toStellarError` inside the fetcher so both frameworks
  surface identical codes.
- Refactor the React hooks to call the fetchers; their public return shapes must
  not change.
- No React, Vue, or browser globals in `queries/`.

---

### Acceptance criteria

- [ ] Each fetcher is unit-tested against the Horizon error fixtures without a DOM
- [ ] `useAccountExists` still maps 404 → `not_funded` and bad input → `invalid_format`
- [ ] Abort signals cancel in-flight fetches where Horizon supports it
- [ ] All existing hook tests pass without modification
- [ ] Fetchers and key builders are exported from `use-stellar/core`
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Hooks being refactored: `packages/core/src/hooks/useAccount.ts`, `useAccountExists.ts`, `useAsset.ts`, `useClaimableBalance.ts`, `useFederationLookup.ts`, `useTransaction.ts`
- Horizon error fixtures: `packages/core/src/__tests__/fixtures/horizon-errors.ts`
- Abort handling: `core-02`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Behavior-preserving extraction only; do not change normalized output shapes.
- Do not import React or Vue from `packages/core/src/runtime`, `queries`, or
  `actions`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
