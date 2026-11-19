---
name: "Vue 72: Grow the Vue demo into a full wallet app"
about: packages/vue-demo is a single App.vue; make it exercise connect, reads, payments and Soroban.
title: "feat(demo): extend the Vue demo with wallet connect, payments and Soroban"
labels: enhancement, vue, framework-agnostic, demo
---

## Grow the Vue demo into a full wallet app

**Complexity:** High (200 points)
**Estimated time:** 2 to 3 days
**Depends on:** `vue-46`

---

### Context

`packages/vue-demo/src` contains only `App.vue`, `main.ts` and `style.css`. It cannot connect a wallet, so it never exercises the write composables — which is exactly where Vue-specific bugs (like the non-reactive wallet in vue-45) hide.

---

### Why this matters

The demo is the first thing a Vue developer runs and our cheapest end-to-end check. A demo that only shows a balance does not prove the package works.

---

### Where this lives

- `packages/vue-demo/src/**`
- `packages/vue-demo/package.json`
- `packages/vue-demo/README.md`

---

### Implementation guidelines

- Pages/sections: connect (Freighter, Rabet, WalletConnect), balance + account, payment history with pagination, send payment, add trustline, a read-only Soroban call.
- Testnet only; add a Friendbot button once vue-64 lands.
- Keep it plain Vue + Vite — no UI framework dependency.

---

### Acceptance criteria

- [ ] `pnpm --filter vue-demo dev` runs and every section works against testnet with Freighter
- [ ] `pnpm --filter vue-demo build` passes in CI
- [ ] README explains how to run it
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] Every example and test uses **testnet only** — no mainnet addresses
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- `packages/vue-demo/src/App.vue`
- React demo for parity: `packages/demo`

---

### Important rules — read before you start

- **Get assigned first.** Do not open a PR before you are assigned. Unassigned PRs
  are closed without review.
- **Target the `dev` branch.** Branch from `dev` and open your PR against `dev`.
  PRs opened against `main` will not be merged.
- **Make sure CI/CD passes.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` locally and confirm green before pushing.
- **Pull before you push.** `git pull --rebase origin dev` right before pushing.
- **Do not touch files outside your task.** Only the files under "Where this
  lives". Do not reformat, rename, or delete unrelated files.
- **Follow existing conventions** — match the surrounding code.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
