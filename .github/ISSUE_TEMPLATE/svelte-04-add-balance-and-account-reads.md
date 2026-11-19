---
name: "Svelte 04: Add balance and account reads"
about: Ship createBalance, createAccount and createAccountExists for Svelte.
title: "feat(svelte): add balance, account and account-exists reads"
labels: enhancement, svelte, framework-agnostic
---

## Add balance and account reads

**Complexity:** Medium (150 points)
**Estimated time:** 1 day
**Depends on:** `svelte-03`

---

### Context

`fetchAccount` and `accountKey` are exported from `use-stellar/core`. The Vue `useBalance` shows the complete pattern.

---

### Why this matters

Balance is the first thing every Stellar UI shows; this is the Svelte quick-start.

---

### Where this lives

- New: `packages/svelte/src/balance.svelte.ts`, `account.svelte.ts` + tests
- `packages/svelte/src/index.ts`

---

### Implementation guidelines

- Arguments accept a value or a getter so they can follow `$state`.
- Balance and account on one address share one request (same `accountKey`).
- Errors are core `StellarError`s with the same codes as React.

---

### Acceptance criteria

- [ ] All three exported and tested against a mocked SDK
- [ ] Balance + account on one address = one request
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
