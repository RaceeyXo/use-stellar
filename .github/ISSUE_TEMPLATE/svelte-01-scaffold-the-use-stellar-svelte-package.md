---
name: "Svelte 01: Scaffold the @use-stellar/svelte package"
about: Create the Svelte 5 adapter package on top of use-stellar/core, the same way @use-stellar/vue is built.
title: "feat(svelte): scaffold the @use-stellar/svelte package"
labels: enhancement, svelte, framework-agnostic, packaging
---

## Scaffold the @use-stellar/svelte package

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

use-stellar now has React, React Native and Vue adapters, all thin layers over the React-free `use-stellar/core` entry (query store, fetchers, actions, wallet registry, errors). Svelte is the next most requested framework and has no adapter.

---

### Why this matters

The core split was designed so a new framework costs an adapter, not a rewrite. This issue sets up the package so the following svelte issues can land independently.

---

### Where this lives

- New: `packages/svelte/` (`package.json`, `tsconfig.json`, `tsup` or `@sveltejs/package` config, `src/index.ts`, `README.md`)
- `pnpm-workspace.yaml` (if needed)

---

### Implementation guidelines

- Target Svelte 5 (runes). Use `@sveltejs/package` so `.svelte.ts` files are compiled correctly.
- `use-stellar` and `svelte` are **peer** dependencies (as in `packages/vue/package.json`), so an app has one copy of core.
- Copy the Vue package's metadata (licence, repository directory, keywords, `publishConfig.access: public`) and its size-limit setup ignoring `use-stellar`.
- Add a Jest or Vitest setup with one placeholder test so CI has something to run.

---

### Acceptance criteria

- [ ] `pnpm --filter @use-stellar/svelte build` produces ESM + types
- [ ] `publint` passes
- [ ] Importing the package does not load React
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
