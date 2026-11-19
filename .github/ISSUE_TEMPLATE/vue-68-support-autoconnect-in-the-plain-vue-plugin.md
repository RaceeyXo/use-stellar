---
name: "Vue 68: Support autoConnect in the plain Vue plugin"
about: Session restore only exists in the Nuxt module; plain Vue (Vite) apps get no autoConnect.
title: "feat(vue): add an autoConnect option to createStellarPlugin"
labels: enhancement, vue, framework-agnostic
---

## Support autoConnect in the plain Vue plugin

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-46`

---

### Context

`restoreWalletSession` exists in `packages/vue/src/plugin.ts` but only the Nuxt module (`packages/vue/src/nuxt/runtime/plugin.ts`) calls it. `createStellarPlugin` has no `autoConnect` option, so a Vite + Vue app loses the wallet on every reload. The React provider has `autoConnect: boolean | { enabled, storage }`.

---

### Why this matters

Reconnecting on reload is expected UX. Asking each app to call an internal helper after `app.mount` is easy to get wrong (e.g. calling it during SSR).

---

### Where this lives

- `packages/vue/src/plugin.ts`
- `packages/vue/src/plugin.test.ts`
- `packages/vue/README.md`

---

### Implementation guidelines

- Add `autoConnect?: boolean | { enabled: boolean; storage?: "local" | "session" }` to `StellarPluginOptions`, same shape as React's.
- Run restore only in the browser (`typeof window !== "undefined"`), after install, and never prompt: keep the `canAutoConnect(network)` check.
- Expose a `restoring` flag (or `connecting: true` during restore) so UIs don't flash a Connect button.
- Have the Nuxt module call the same code path instead of its own.

---

### Acceptance criteria

- [ ] A saved session reconnects silently on install when `canAutoConnect` is true
- [ ] When it is false the wallet name is remembered but nothing prompts
- [ ] No restore runs during SSR
- [ ] Nuxt and plain Vue share one implementation
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

- `restoreWalletSession` in `packages/vue/src/plugin.ts`
- `packages/vue/src/nuxt/runtime/plugin.ts`
- React prop: `autoConnect` in `packages/core/src/context/StellarProvider.tsx`

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
