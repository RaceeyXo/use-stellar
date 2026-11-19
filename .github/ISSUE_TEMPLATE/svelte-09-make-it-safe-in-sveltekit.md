---
name: "Svelte 09: Make it safe in SvelteKit"
about: Guarantee no fetches, wallet calls or shared state leak during SvelteKit server rendering.
title: "test(svelte): guarantee SvelteKit SSR safety and per-request isolation"
labels: enhancement, svelte, framework-agnostic, ssr
---

## Make it safe in SvelteKit

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `svelte-04`

---

### Context

SvelteKit renders on the server. Module-level state there is shared between requests, so a runtime created at module scope would leak one user's wallet into another's page. Vue solved the same problem (see `packages/vue/src/__tests__/ssr.test.ts`).

---

### Why this matters

An SSR state leak is a security bug, not a cosmetic one.

---

### Where this lives

- New: `packages/svelte/src/__tests__/ssr.test.ts`
- `packages/svelte/README.md` (SvelteKit section)

---

### Implementation guidelines

- Render components with `svelte/server` and assert no request is made and no wallet adapter is touched.
- Assert two concurrent renders get independent runtimes.
- Document creating the context in `+layout.svelte`, never at module scope.

---

### Acceptance criteria

- [ ] SSR makes zero network calls
- [ ] Concurrent renders do not share state
- [ ] README SvelteKit section
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
