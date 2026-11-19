---
name: "Svelte 11: Wire Svelte into CI, docs and the release"
about: Run quality checks, size budget and the manual release for @use-stellar/svelte.
title: "ci(svelte): add CI checks, docs and release for @use-stellar/svelte"
labels: enhancement, svelte, framework-agnostic, ci
---

## Wire Svelte into CI, docs and the release

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `svelte-01`

---

### Context

The Vue and React Native packages are covered by the root `lint`, `typecheck`, `test`, `build:lib` and `size` scripts, and the manual release workflow. A new package needs the same, plus docs pages.

---

### Why this matters

An untested, undocumented package should not be published.

---

### Where this lives

- Root `package.json` scripts
- `.github/workflows/` (Svelte steps only)
- New: `docs/svelte/*.md`
- `packages/svelte/README.md`

---

### Implementation guidelines

- Add the package to the existing scripts rather than new workflows where possible.
- Keep the release workflow manual (`workflow_dispatch`), like the others.
- Add a smoke test that installs the packed tarball and checks React is not loaded.

---

### Acceptance criteria

- [ ] CI runs Svelte lint/typecheck/tests/size
- [ ] Smoke test passes on the packed tarball
- [ ] Docs section exists
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
