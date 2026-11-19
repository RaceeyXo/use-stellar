---
name: "React Native 40: Add React Native pages to the docs site"
about: docs/ has no React Native section; the only guide is the package README.
title: "docs(react-native): add a React Native section to the docs"
labels: enhancement, react-native, framework-agnostic, documentation
---

## Add React Native pages to the docs site

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

`docs/` has `getting-started`, `guides`, `hooks`, `reference` and `vue`, but nothing for React Native. Setup, polyfills, WalletConnect configuration and deep links are only in `packages/react-native/README.md`.

---

### Why this matters

Mobile developers search the docs site; with no section the package looks unsupported, and the README cannot hold troubleshooting at the depth people need.

---

### Where this lives

- New: `docs/react-native/*.md`

---

### Implementation guidelines

- Pages: installation & polyfills, provider props, connecting mobile wallets, deep links, storage, testing with `@use-stellar/react-native/test-utils`, troubleshooting (Metro, Hermes, missing polyfill errors).
- Every code sample must match the current exports — check each import against `packages/react-native/src/index.ts`.

---

### Acceptance criteria

- [ ] The section exists with the listed pages
- [ ] Every import in every sample exists
- [ ] Troubleshooting covers the `checkStellarRuntime()` messages
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

- `packages/react-native/README.md`
- `packages/react-native/TEST-UTILS.md`

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
