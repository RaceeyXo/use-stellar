---
name: "Vue 10: Add a Vue adapter test harness and quickstart"
about: Establish repeatable Vue composable tests and document the plugin, runtime configuration, wallet, and balance setup flow.
title: "test(docs): add Vue adapter harness and quickstart"
labels: enhancement, vue, framework-agnostic, documentation
---

## Add a Vue adapter test harness and quickstart

**Complexity:** Medium (100 points)
**Estimated time:** 1 day
**Depends on:** `vue-06`, `vue-08`, `vue-09`

---

### Context

The Vue adapter needs a durable testing pattern for plugins and composables, plus
a minimal guide that lets developers install it, configure testnet, and use the
first wallet and balance APIs correctly.

---

### Why this matters

Without an adapter-level test harness, later composables are likely to leak Vue
scopes or silently diverge from runtime behavior. Without a quickstart, a
publishable package is difficult for the first Vue users to adopt correctly.

---

### Where this lives

- New: `packages/vue/src/test-utils.ts`
- New: `packages/vue/src/test-utils.test.ts`
- New: `docs/guides/vue.md`
- Update: `README.md`
- Update: `packages/vue/package.json` only for narrowly required test tooling

---

### Implementation guidelines

- Add a reusable helper that mounts a Vue effect scope or app with the Stellar
  plugin and guarantees disposal after each test.
- Show mocked runtime, wallet-adapter, and Horizon patterns; no live services.
- Write a concise Vue 3 quickstart covering installation, plugin registration,
  testnet configuration, `useStellar`, `useWallet`, and `useBalance`.
- Make clear that the Vue adapter is a separate package and that React APIs are
  not imported from it.
- Do not add more composables or broaden the core runtime in this issue.

---

### Acceptance criteria

- [ ] A reusable test helper installs and disposes the Vue plugin correctly
- [ ] A sample test proves plugin injection and reactive updates work
- [ ] The quickstart contains copy-pasteable Vue 3 testnet setup
- [ ] Wallet and balance examples use mocks or testnet-only values
- [ ] README links to the Vue quickstart and package name
- [ ] Vue build, typecheck, documentation checks, and affected tests pass

---

### Reference

- Vue plugin: `vue-06`
- Base composable: `vue-07`
- First Vue APIs: `vue-08`, `vue-09`
- Existing documentation style: `docs/`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Keep fixtures deterministic and avoid live wallet or Horizon dependencies.
- Do not alter existing React documentation except for a focused navigation link.
- Use testnet only in every example and fixture.
- Include `Closes #[issue number]` in the PR description.
