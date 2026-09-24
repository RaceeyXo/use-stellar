---
name: "Wallets 01: Add a shared wallet adapter conformance test kit"
about: Provide one reusable test suite every wallet adapter must pass, so new integrations are held to the same contract.
title: "test(wallets): add a shared WalletAdapter conformance suite"
labels: enhancement, wallets, framework-agnostic, testing
---

## Add a shared wallet adapter conformance test kit

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

Freighter and Albedo each have hand-written tests that check different things.
As LOBSTR, Rabet, xBull, Hana, WalletConnect, Ledger, Trezor, and HOT adapters
are added, the contract in `wallets/types.ts` — optional `resolveNetwork`,
`canAutoConnect`, and `subscribe`, plus error codes — needs one executable
definition.

---

### Why this matters

Hooks never branch on wallet type; they trust the contract. A single adapter
that returns a wrong network shape or throws a raw `Error` breaks every
framework’s wallet flow at once. A conformance suite catches that in the
adapter’s own PR.

---

### Where this lives

- New: `packages/core/src/wallets/testing/conformance.ts`
- New: `packages/core/src/wallets/testing/conformance.test.ts`
- Update: `packages/core/src/wallets/freighterAdapter.test.ts`
- Update: `packages/core/src/wallets/albedoAdapter.test.ts`

---

### Implementation guidelines

- Export `describeWalletAdapter(name, createAdapter, fakes)` that runs a
  standard set of Jest cases given injected fakes for the vendor SDK.
- Cover metadata shape, availability, connect result shape, network details,
  sign with correct passphrase, rejection mapping, optional
  `resolveNetwork`/`canAutoConnect`/`subscribe` shapes, and unsubscribe cleanup.
- Skip optional-method cases cleanly when the adapter omits them.
- Run Freighter and Albedo through the suite without changing their behavior.

---

### Acceptance criteria

- [ ] The suite runs against Freighter and Albedo and passes
- [ ] A deliberately broken fake adapter fails the suite with clear messages
- [ ] Optional methods are validated only when present
- [ ] The kit is not included in the published bundle
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Adapter contract: `packages/core/src/wallets/types.ts`
- Registry tests: `packages/core/src/wallets/registry.test.ts`
- Error mapping: `core-04`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not change adapter behavior to make the suite pass; report genuine contract
  violations as bugs.
- Mock the wallet SDK or injected provider in tests; never require a real
  extension, device, or funded account.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
