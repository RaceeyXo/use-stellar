---
name: "Vue 18: Add the Vue useNetwork composable"
about: Expose the runtime’s active network and resolved configuration to Vue as reactive, read-only state.
title: "feat(vue): add the useNetwork composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useNetwork composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-07`

---

### Context

React’s `useNetwork` returns the active network and its resolved Horizon URL,
Soroban URL, and passphrase. Vue components need the same values reactively —
for example to render a network badge or build explorer links.

---

### Why this matters

Apps that read `NETWORK_CONFIGS` directly instead of the runtime ignore custom
`networkConfig` overrides. A first-class composable steers Vue users to the
single source of truth.

---

### Where this lives

- New: `packages/vue/src/useNetwork.ts`
- New: `packages/vue/src/useNetwork.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Derive every field from the injected runtime snapshot via `computed`; do not
  copy it into local refs.
- Return the same fields as React’s `UseNetworkReturn`, read-only.
- Updates must flow when the runtime network changes (for example a plugin
  reconfiguration in tests).

---

### Acceptance criteria

- [ ] Returned values match the runtime’s resolved config for testnet and a custom network
- [ ] Values update reactively when the runtime network changes
- [ ] Consumers cannot mutate runtime network state through the returned values
- [ ] Missing plugin produces the actionable error from `vue-06`
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useNetwork.ts`
- Network resolution: `vue-01`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
