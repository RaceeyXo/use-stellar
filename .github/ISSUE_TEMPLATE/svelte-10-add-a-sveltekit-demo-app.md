---
name: "Svelte 10: Add a SvelteKit demo app"
about: A small SvelteKit app that connects a wallet, shows balance and history, and sends a payment.
title: "feat(demo): add a SvelteKit demo for @use-stellar/svelte"
labels: enhancement, svelte, framework-agnostic, demo
---

## Add a SvelteKit demo app

**Complexity:** High (200 points)
**Estimated time:** 2 to 3 days
**Depends on:** `svelte-07`

---

### Context

React has `packages/demo`, Vue has `packages/vue-demo`. Svelte needs the same to prove the adapter end to end.

---

### Why this matters

The demo is our end-to-end check and the first thing a Svelte developer runs.

---

### Where this lives

- New: `packages/svelte-demo/**`

---

### Implementation guidelines

- Testnet only; Freighter connect, balance, payments, send payment.
- Build it in CI.

---

### Acceptance criteria

- [ ] `pnpm --filter svelte-demo build` passes
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

- Vue adapter to mirror: `packages/vue/src/plugin.ts`, `packages/vue/src/internal/useQuery.ts`
- React-free core: `packages/core/src/core.ts`
- Svelte 5 runes: https://svelte.dev/docs/svelte/what-are-runes

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
