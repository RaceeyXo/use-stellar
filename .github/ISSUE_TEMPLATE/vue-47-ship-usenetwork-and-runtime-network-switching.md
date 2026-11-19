---
name: "Vue 47: Ship useNetwork and runtime network switching"
about: The Vue runtime's network is fixed at install time; add useNetwork and a switchNetwork that keeps the cache correct.
title: "feat(vue): add useNetwork and switchNetwork to the Vue runtime"
labels: enhancement, vue, framework-agnostic
---

## Ship useNetwork and runtime network switching

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-45`

---

### Context

`createStellarRuntime` resolves `network` and `networkConfig` once and stores them as plain properties. There is no way to move a running Vue app from testnet to mainnet, and no composable exposes the current network or a wallet/app network mismatch. The React package has `useNetwork` (`packages/core/src/hooks/useNetwork.ts`).

---

### Why this matters

Network toggles are a standard dApp control, and a mismatch warning ("your wallet is on mainnet, this app is on testnet") prevents users signing on the wrong network. Without reactivity every composable keeps querying the old Horizon URL after a switch.

---

### Where this lives

- `packages/vue/src/plugin.ts`
- New: `packages/vue/src/useNetwork.ts` + test
- `packages/vue/src/index.ts`
- Docs: `docs/vue/use-network.md`

---

### Implementation guidelines

- Make `network`/`networkConfig` reactive (read-only refs) and add `switchNetwork(network, config?)`.
- Every query key already includes the Horizon URL and network, so read composables refetch automatically once their `queryKey` getter reads the reactive config — verify this with a test rather than assuming it.
- `useNetwork` returns `network`, `networkConfig`, `isMainnet`, `walletNetwork`, `isMismatch` (wallet passphrase ≠ app passphrase) and `switchNetwork`.
- Do not silently disconnect the wallet on switch; surface the mismatch instead, as React does.

---

### Acceptance criteria

- [ ] After `switchNetwork("mainnet")` a mounted `useBalance` refetches from the mainnet Horizon URL
- [ ] `isMismatch` is true when the wallet passphrase differs from the app's
- [ ] Write composables use the network current at call time
- [ ] Docs page added
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

- React hook: `packages/core/src/hooks/useNetwork.ts`
- `NETWORK_CONFIGS` in `packages/core/src/types`
- `packages/vue/src/plugin.ts` (`resolveNetworkConfig`)

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
