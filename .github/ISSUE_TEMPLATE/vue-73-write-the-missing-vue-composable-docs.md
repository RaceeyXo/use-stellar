---
name: "Vue 73: Write the missing Vue composable docs"
about: docs/vue has 3 pages; every shipped composable needs one.
title: "docs(vue): add reference pages for every shipped Vue composable"
labels: enhancement, vue, framework-agnostic, documentation
---

## Write the missing Vue composable docs

**Complexity:** Medium (150 points)
**Estimated time:** 2 days

---

### Context

`docs/vue/` has only `use-add-trustline.md`, `use-balance.md` and `use-path-payment.md`. `useClaimableBalance`, `usePayments`, `usePaymentHistory`, `useSendPayment`, `useSorobanContract`, `useContractEvents`, the plugin and the test harness have no page, while `docs/hooks/` covers every React hook.

---

### Why this matters

The npm README is a quick start; the docs site is where people look up an option. Undocumented composables look unsupported.

---

### Where this lives

- `docs/vue/*.md`
- `docs/vue/index.md` (new, lists all pages)

---

### Implementation guidelines

- One page per composable, same section order as `docs/hooks/*.md`: signature, options table, return table, example, errors.
- Generate option tables from the actual TypeScript types — check every field against `packages/vue/src`.
- Add pages for `createStellarPlugin` and `createStellarTestHarness`.
- Composables added by other issues in this wave add their own pages; this issue covers what is shipped today.

---

### Acceptance criteria

- [ ] Every composable exported from `@use-stellar/vue` today has a page
- [ ] Every option in the tables exists in the source
- [ ] An index page links them all
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

- `docs/hooks/` (React pages to mirror)
- `packages/vue/README.md`

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
