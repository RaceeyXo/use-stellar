---
name: "Svelte 07: Add the transaction write APIs"
about: Ship sendPayment, addTrustline and pathPayment for Svelte over the core actions.
title: "feat(svelte): add send payment, add trustline and path payment"
labels: enhancement, svelte, framework-agnostic
---

## Add the transaction write APIs

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `svelte-06`

---

### Context

`sendPayment`, `addTrustline` and `pathPayment` are React-free actions in `use-stellar/core`, already shared by React and Vue.

---

### Why this matters

Sending a payment is the core write flow.

---

### Where this lives

- New: `packages/svelte/src/actions.svelte.ts` + test
- `packages/svelte/src/index.ts`

---

### Implementation guidelines

- Copy the Vue composables' state handling (operation id so stale calls cannot overwrite newer state, `reset()`, offline check).
- Build the action runtime in one helper that includes `transactionTimeout`.

---

### Acceptance criteria

- [ ] Success, rejection, `TX_TIMEOUT` → pending and submission failure each leave documented state
- [ ] Successful submits invalidate account queries
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
