---
name: "Vue 06: Add the Vue Stellar plugin and runtime injection"
about: Provide a Vue 3 plugin that creates or accepts a shared Stellar runtime and exposes it through provide/inject.
title: "feat(vue): add the Stellar plugin and runtime injection"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue Stellar plugin and runtime injection

**Complexity:** High (150 points)
**Estimated time:** 1 day
**Depends on:** `vue-02`, `vue-05`

---

### Context

Vue applications need one application-scoped Stellar runtime, analogous to the
React provider but implemented with Vue’s plugin and dependency-injection model.
Add the adapter boundary without duplicating network, wallet, or cache logic.

---

### Why this matters

The plugin gives every Vue composable the same runtime instance. That prevents
multiple caches or conflicting network configuration from appearing across a
single Vue application.

---

### Where this lives

- New: `packages/vue/src/plugin.ts`
- New: `packages/vue/src/keys.ts`
- New: `packages/vue/src/plugin.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Export `createStellarPlugin(options)` and a typed injection key.
- Accept either runtime options or an existing `StellarRuntime`; never construct
  framework-specific state inside the shared runtime.
- Install exactly one runtime under the injection key and expose a predictable
  error path for a missing plugin.
- Keep plugin install SSR-safe: do not access `window`, storage, or wallets.
- Use Vue 3 APIs only in `packages/vue`.

---

### Acceptance criteria

- [ ] A Vue app can install the plugin with testnet configuration
- [ ] A supplied runtime is used as-is and is not recreated by the plugin
- [ ] The typed injection key returns the installed runtime
- [ ] Missing-plugin errors are actionable and mention installation
- [ ] Plugin tests run in a Vue test environment without a browser wallet
- [ ] `pnpm --filter @use-stellar/vue build` and affected tests pass

---

### Reference

- React equivalent: `packages/core/src/context/StellarProvider.tsx`
- Shared state boundary: `vue-02`
- Vue package boundary: `vue-05`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Do not duplicate runtime state in Vue refs or reactive objects.
- Do not import Vue from `packages/core`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.

