---
name: "Vue 39: Add a Nuxt module for the Vue adapter"
about: Ship a thin Nuxt module that installs the Stellar plugin client- and server-side with runtime config support.
title: "feat(vue): add a Nuxt module for @use-stellar/vue"
labels: enhancement, vue, framework-agnostic, ssr
---

## Add a Nuxt module for the Vue adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-38`

---

### Context

Nuxt users currently have to write a plugin file by hand, decide where to create
the runtime, and remember to keep wallet code client-only. A small module can do
this correctly once.

---

### Why this matters

Nuxt is the dominant Vue meta-framework. A correct default setup prevents the
per-request state leaks and wallet-on-server crashes that hand-written plugins
commonly introduce.

---

### Where this lives

- New: `packages/vue/src/nuxt/module.ts`
- New: `packages/vue/src/nuxt/runtime/plugin.ts`
- New: `packages/vue/src/nuxt/module.test.ts`
- Update: `packages/vue/package.json` (`./nuxt` export and optional `@nuxt/kit` peer)
- Update: `packages/vue/tsup.config.ts`

---

### Implementation guidelines

- Read `network`, `networkConfig`, `queryConfig`, and `autoConnect` from Nuxt
  `runtimeConfig.public.stellar`.
- Create one runtime per request on the server and one per app on the client.
- Run wallet restore only on the client.
- Keep `@nuxt/kit` an optional peer so non-Nuxt Vue users do not install it.

---

### Acceptance criteria

- [ ] A fixture Nuxt config installs the module and exposes composables
- [ ] Runtime config values reach the runtime, including a custom network
- [ ] Server requests do not share runtime state
- [ ] The main `@use-stellar/vue` entry does not import Nuxt
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- Vue plugin: `vue-06`
- SSR guarantees: `vue-38`
- Nuxt module author guide: https://nuxt.com/docs/guide/going-further/modules

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not require Nuxt for plain Vue users.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
