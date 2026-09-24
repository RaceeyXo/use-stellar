---
name: "Vue 40: Add a Vite + Vue demo app for the adapter"
about: Mirror the Next.js demo with a Vue 3 demo that exercises wallet, reads, history, Soroban, and payments on testnet.
title: "feat(demo): add a Vite + Vue 3 demo for @use-stellar/vue"
labels: enhancement, vue, framework-agnostic, demo
---

## Add a Vite + Vue demo app for the adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-21`, `vue-27`, `vue-33`, `vue-35`

---

### Context

`packages/demo` shows the React hooks in a Next.js app. Vue users need an
equivalent reference that compiles against the published adapter API, and
maintainers need a place to manually verify wallet flows.

---

### Why this matters

A demo that builds in CI is the cheapest end-to-end check that the adapter’s
exports, types, and bundling work together in a real Vue app.

---

### Where this lives

- New: `packages/vue-demo/` (Vite + Vue 3 + TypeScript)
- Update: root `package.json` scripts (`dev:vue`, `build:vue-demo`)

---

### Implementation guidelines

- Default to testnet and show a network badge from `useNetwork`.
- Include sections for wallet connect/disconnect, balance and account, payment
  history with paging, a Soroban read, and a send-payment form.
- Consume `@use-stellar/vue` through the workspace, not relative source imports.
- Keep styling minimal; reuse demo copy from `packages/demo` where it applies.

---

### Acceptance criteria

- [ ] `pnpm --filter @use-stellar/vue-demo build` succeeds
- [ ] Each section uses only public adapter exports
- [ ] No mainnet endpoints or secrets are present
- [ ] Typecheck passes for the demo

---

### Reference

- React demo: `packages/demo`
- Vue quickstart: `vue-10`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- The demo must not import from `packages/vue/src` directly.
- Never embed secret keys.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
