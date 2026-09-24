---
name: "Vue 17: Extract payment-path and anchor (SEP-1) fetchers"
about: Move strict-send/strict-receive path discovery and stellar.toml resolution out of React hooks into shared, abortable fetchers.
title: "refactor(core): extract payment-path and stellar.toml fetchers"
labels: enhancement, vue, framework-agnostic, refactor
---

## Extract payment-path and anchor (SEP-1) fetchers

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-13`

---

### Context

`usePaymentPaths` builds strict-send or strict-receive path queries, normalizes
`PaymentPath` records, and computes `rate`. `useAnchor` normalizes a home
domain, resolves `stellar.toml` through `StellarToml.Resolver` with its own
abort and timeout handling, and maps it into `AnchorInfo`.

Extract both into `fetchPaymentPaths(networkConfig, options, { signal })` and
`fetchAnchorInfo(homeDomain, { signal, timeout })`.

---

### Why this matters

Path rate calculation and TOML field mapping are user-visible numbers and
endpoints. They must be identical across frameworks, especially since
`useAnchor` output feeds SEP-10/SEP-24 flows.

---

### Where this lives

- New: `packages/core/src/queries/paymentPaths.ts`
- New: `packages/core/src/queries/anchor.ts`
- New: matching `*.test.ts` files
- Update: `packages/core/src/hooks/usePaymentPaths.ts`, `useAnchor.ts`

---

### Implementation guidelines

- Keep the discriminated `mode` union and validation exactly as the React hook
  enforces it.
- Move the home-domain normalization and timeout into the fetcher; the hook
  keeps only its React state.
- Reuse `paymentPathsKey`; add an `anchorKey` only if `useAnchor` is moved onto
  the cache in the same change.
- Refactor both React hooks with no public API change.

---

### Acceptance criteria

- [ ] Strict-send and strict-receive fetchers are unit-tested with mocked Horizon
- [ ] Anchor fetcher handles timeout, abort, and malformed TOML with `StellarError`s
- [ ] Existing `usePaymentPaths` and `useAnchor` tests pass unchanged
- [ ] Exports are available from `use-stellar/core`
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Current hooks: `packages/core/src/hooks/usePaymentPaths.ts`, `useAnchor.ts`
- SEP-1 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Behavior-preserving extraction only.
- Do not import React or Vue from `packages/core/src/runtime`, `queries`, or
  `actions`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
