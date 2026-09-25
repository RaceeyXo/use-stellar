---
name: "Vue 44: Add React/Vue parity contract tests"
about: Run the same fixtures through React hooks and Vue composables and assert identical outputs, keys, and errors.
title: "test: add React and Vue parity contract tests"
labels: enhancement, vue, framework-agnostic, testing
---

## Add React/Vue parity contract tests

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-37`

---

### Context

React and Vue now share fetchers, actions, and the cache, but each adapter still
owns state projection, input handling, and lifecycle. Nothing proves the two
adapters return the same values for the same inputs.

---

### Why this matters

Parity is the promise of the framework-agnostic work. A shared contract suite
turns ‘should behave the same’ into a failing test the moment one adapter
drifts.

---

### Where this lives

- New: `packages/core/src/__tests__/contracts/` (shared fixtures and expectations)
- New: `packages/core/src/__tests__/contracts/react.contract.test.tsx`
- New: `packages/vue/src/__tests__/vue.contract.test.ts`

---

### Implementation guidelines

- Define each contract once as data: inputs, mocked Horizon/RPC responses,
  expected return fields, expected cache key, and expected error code.
- Run the same contracts through each React hook and each Vue composable.
- Cover idle inputs, success, 404, rate limit, and a wallet rejection for write
  APIs.
- Keep contracts framework-free so React Native can reuse them later.

---

### Acceptance criteria

- [ ] Every public read and write API has at least one shared contract
- [ ] Both adapters pass the same contract data
- [ ] A deliberate divergence in either adapter fails the suite
- [ ] Both packages’ test commands run their side of the contracts

---

### Reference

- Horizon fixtures: `packages/core/src/__tests__/fixtures/horizon-errors.ts`
- SDK mock: `packages/core/src/__mocks__/@stellar/stellar-sdk.ts`
- Mock depth: `test-04`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Contracts must describe current React behavior; do not change React to fit
  Vue.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
