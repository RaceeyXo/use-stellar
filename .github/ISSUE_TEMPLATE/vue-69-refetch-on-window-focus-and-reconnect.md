---
name: "Vue 69: Refetch on window focus and reconnect"
about: The Vue query adapter never refetches stale data on focus or when the browser comes back online.
title: "feat(vue): refetch stale queries on window focus and when back online"
labels: enhancement, vue, framework-agnostic
---

## Refetch on window focus and reconnect

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

`packages/vue/src/internal/useQuery.ts` has no focus or online handling. The React side pauses and resumes through the platform focus/online managers, and core already exports `onlineManager` (`packages/core/src/runtime/onlineManager.ts`). A Vue tab left in the background shows minutes-old balances when the user returns.

---

### Why this matters

Stale balances after a tab switch are the most common "is this broken?" report for wallet UIs. The React and Vue packages should behave the same on the same core.

---

### Where this lives

- `packages/vue/src/internal/useQuery.ts`
- `packages/vue/src/plugin.ts` (options)
- `packages/vue/src/internal/useQuery.test.ts` (new)

---

### Implementation guidelines

- Subscribe once per runtime (not per composable) to `visibilitychange` and the core `onlineManager`; on focus/online, refetch **stale** active queries only.
- Add `refetchOnFocus` / `refetchOnReconnect` to `queryConfig` (default `true`), mirroring React.
- Guard everything with `typeof document !== "undefined"` for SSR.

---

### Acceptance criteria

- [ ] Returning to the tab refetches a stale query and not a fresh one
- [ ] Going online refetches stale queries
- [ ] Both can be disabled through `queryConfig`
- [ ] No listeners are registered during SSR
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

- `packages/vue/src/internal/useQuery.ts`
- `packages/core/src/runtime/onlineManager.ts`
- React focus manager: `packages/react-native/src/platform/appStateFocus.ts` (the native counterpart)

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
