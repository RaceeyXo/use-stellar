---
name: "Svelte 06: Add wallet connect and disconnect"
about: Ship createWallet over the core wallet registry, with session persistence.
title: "feat(svelte): add wallet connect, disconnect and session restore"
labels: enhancement, svelte, framework-agnostic
---

## Add wallet connect and disconnect

**Complexity:** Very High (300 points)
**Estimated time:** 3 days
**Depends on:** `svelte-02`, `vue-46`

---

### Context

Wallet adapters and the registry are in `use-stellar/core`. vue-46 extracts the React `useWallet` state machine into core — build on that extraction rather than writing a third copy.

---

### Why this matters

Without a wallet, the write APIs are unusable.

---

### Where this lives

- New: `packages/svelte/src/wallet.svelte.ts` + test
- `packages/svelte/src/index.ts`

---

### Implementation guidelines

- Thin adapter over the extracted core connection module from vue-46.
- Expose `address`, `connected`, `connecting`, `walletName`, `error`, `availableWallets`, `connect(id)`, `disconnect()`.
- `autoConnect` option on the context, browser only, never prompting (keep `canAutoConnect(network)`).

---

### Acceptance criteria

- [ ] Connect with a mocked adapter sets the full wallet state
- [ ] Rejection gives `WALLET_REQUEST_REJECTED`
- [ ] Session restores on reload without prompting
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
