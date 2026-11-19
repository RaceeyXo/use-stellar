---
name: "Svelte 03: Add the internal query adapter"
about: Bridge core's QueryObserver to Svelte 5 reactivity, the way packages/vue/src/internal/useQuery.ts does for Vue.
title: "feat(svelte): add an internal createQuery adapter over the core QueryObserver"
labels: enhancement, svelte, framework-agnostic
---

## Add the internal query adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `svelte-02`

---

### Context

All read hooks share core's `QueryStore` and `createQueryObserver`. The Vue adapter wraps them in `internal/useQuery.ts` (reactive key, enabled flag, stale time, retries, cleanup).

---

### Why this matters

With this adapter each Svelte read API is ~30 lines, and every one gets dedup, caching and retries for free.

---

### Where this lives

- New: `packages/svelte/src/internal/createQuery.svelte.ts` + test

---

### Implementation guidelines

- Port `packages/vue/src/internal/useQuery.ts` behaviour exactly: reactive `queryKey`/`enabled` getters, `staleTime`, `maxRetries`, `refetch`.
- Unsubscribe in the effect teardown (`$effect` return).
- No fetch during SSR.

---

### Acceptance criteria

- [ ] Same key from two components → one request
- [ ] Key change refetches; disabled query does nothing
- [ ] Teardown unsubscribes (no leaked observers)
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
