---
name: "Vue 41: Document every Vue composable"
about: Add a Vue reference page per composable following docs/example.md, with reactive-input and lifecycle notes.
title: "docs(vue): add reference pages for every Vue composable"
labels: enhancement, vue, framework-agnostic, documentation
---

## Document every Vue composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-37`

---

### Context

`docs/hooks/` has one page per React hook following `docs/example.md`. `vue-10`
added only a quickstart. Vue users need the same per-API reference with
Vue-specific notes on refs, getters, and scope disposal.

---

### Why this matters

Undocumented differences — for example that inputs accept getters, or that
composables must run inside an effect scope — become support tickets.
Documenting them once per composable prevents that.

---

### Where this lives

- New: `docs/vue/` with one page per composable
- Update: `docs/guides/vue.md` (link the reference)
- Update: `README.md` (Vue section navigation only)

---

### Implementation guidelines

- Follow `docs/example.md` section order exactly.
- Every example uses `<script setup lang="ts">`, testnet, and public exports
  only.
- Add a short ‘Differences from React’ section only where behavior genuinely
  differs.
- Link each page to its React counterpart.

---

### Acceptance criteria

- [ ] Every exported composable has a page
- [ ] All examples typecheck against the published types
- [ ] No example uses mainnet or a secret key
- [ ] Quickstart links to every page

---

### Reference

- Template: `docs/example.md`
- React pages: `docs/hooks/`
- Quickstart: `vue-10`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not change React documentation beyond navigation links.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
