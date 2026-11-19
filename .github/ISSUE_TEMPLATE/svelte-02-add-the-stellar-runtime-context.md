---
name: "Svelte 02: Add the Stellar runtime context"
about: Provide one runtime (network config, query store, wallet state) per app through Svelte context.
title: "feat(svelte): add setStellarContext and getStellarRuntime"
labels: enhancement, svelte, framework-agnostic
---

## Add the Stellar runtime context

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `svelte-01`

---

### Context

The Vue adapter's `createStellarRuntime` holds the network config, one `QueryStore` and the wallet state, and installs it with `provide`. Svelte's equivalent is `setContext`/`getContext`.

---

### Why this matters

Every Svelte composable reads through this runtime; it must exist before any of them.

---

### Where this lives

- New: `packages/svelte/src/runtime.svelte.ts` + test
- `packages/svelte/src/index.ts`

---

### Implementation guidelines

- `setStellarContext(options)` in the root layout; `getStellarRuntime()` everywhere else, throwing a clear error when missing.
- Wallet and network state as `$state`, exposed read-only; mutations through methods (learn from Vue issue vue-45: the wallet must be reactive from day one).
- Options mirror the Vue plugin: `network`, `networkConfig`, `queryConfig`, `transactionTimeout`.

---

### Acceptance criteria

- [ ] Missing context throws an actionable error
- [ ] Changing wallet state updates a component that reads it
- [ ] Two apps on one page get separate runtimes
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
