---
name: "Vue 38: Guarantee SSR safety and hydration for the Vue adapter"
about: Prove every Vue composable renders on the server without wallet, storage, or network side effects and hydrates cleanly.
title: "test(vue): add SSR and hydration guarantees for all composables"
labels: enhancement, vue, framework-agnostic, ssr
---

## Guarantee SSR safety and hydration for the Vue adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-19`, `vue-35`

---

### Context

The React package has `ssr.test.ts` and `ssr-guard.test.tsx`. The Vue adapter
has no equivalent, yet Nuxt and Vite SSR are the most common Vue deployment
targets.

Add an SSR test suite that renders every exported composable with `createSSRApp`
and `renderToString`, then hydrates on a jsdom client.

---

### Why this matters

A single `window` access during setup crashes a Nuxt page. A fetch during SSR
doubles Horizon load and leaks state between requests. Both must be caught in
CI, not in production.

---

### Where this lives

- New: `packages/vue/src/__tests__/ssr.test.ts`
- New: `packages/vue/src/__tests__/hydration.test.ts`
- Update: any composable that touches browser globals during setup

---

### Implementation guidelines

- Render each composable in a server app with no `window`, `localStorage`, or
  wallet present.
- Assert no Horizon or RPC calls happen during server render unless the caller
  opts in.
- Assert one runtime per SSR request when the plugin is installed per app, so no
  state leaks across requests.
- Hydrate on the client and assert no hydration mismatch warnings for idle
  state.

---

### Acceptance criteria

- [ ] Every exported composable renders to string without throwing
- [ ] No network, storage, or wallet access happens on the server
- [ ] Two concurrent SSR apps do not share runtime state
- [ ] Client hydration produces no mismatch warnings
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React SSR tests: `packages/core/src/__tests__/ssr.test.ts`, `ssr-guard.test.tsx`
- SSR guide: `docs/guides/ssr.md`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Fix SSR issues at the runtime or composable that causes them, not with
  test-only guards.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
