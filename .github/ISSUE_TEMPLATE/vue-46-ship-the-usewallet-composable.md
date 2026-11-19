---
name: "Vue 46: Ship the useWallet composable"
about: Vue apps have to wire wallet adapters to the runtime by hand; add useWallet with connect, disconnect, available wallets and session persistence.
title: "feat(vue): ship useWallet with connect, disconnect and available wallets"
labels: enhancement, vue, framework-agnostic
---

## Ship the useWallet composable

**Complexity:** Very High (300 points)
**Estimated time:** 3 to 4 days
**Depends on:** `vue-45`

---

### Context

The @use-stellar/vue README currently says: *"This release has no `useWallet` composable yet"* and shows ~20 lines of manual wiring — register an adapter, call `adapter.connect(runtime.network)`, then build a full `WalletState` by hand for `runtime.setWallet`.

The React `useWallet` (`packages/core/src/hooks/useWallet.ts`, ~300 lines) holds that logic inside the hook, so it cannot be reused from Vue as-is.

---

### Why this matters

Connecting a wallet is the first thing every dApp does. Hand-building `WalletState` is error-prone (forgetting `walletNetworkPassphrase` silently disables the network-mismatch guard in the write actions) and is the most visible gap between the Vue and React packages.

---

### Where this lives

- New: `packages/core/src/runtime/walletConnection.ts` — the connect/disconnect state machine extracted from the React hook
- `packages/core/src/hooks/useWallet.ts` — thin adapter over it
- `packages/core/src/core.ts`
- New: `packages/vue/src/useWallet.ts` + test, `packages/vue/src/index.ts`
- `packages/vue/README.md` — replace the manual-wiring section
- Docs: `docs/vue/use-wallet.md`

---

### Implementation guidelines

- **Extract first.** Move `connect(walletId)`, `disconnect()`, the `connecting`/`error` transitions, `getNetworkDetails` and session writes (`writeWalletSession` / `clearWalletSession` in `packages/core/src/runtime/walletSession.ts`) into a React-free module. The React hook's tests must pass unchanged.
- The composable returns `address`, `connected`, `connecting`, `walletName`, `error`, `availableWallets` (from the registry, filtered by `isAvailable()` and the platform), `connect(id)` and `disconnect()`.
- Write through `runtime.setWallet` so every other composable sees the change (requires vue-45).
- Persist the session the same way React does, so the Nuxt module's restore (`restoreWalletSession`) finds it.
- Concurrent `connect()` calls: the second must not leave the state stuck in `connecting` — match the React hook's behaviour.

---

### Acceptance criteria

- [ ] `useWallet` is exported and the README's manual-wiring section is replaced by it
- [ ] `connect("freighter")` with a mocked adapter sets every `WalletState` field including `walletNetworkPassphrase`
- [ ] A rejected connection sets `error` with code `WALLET_REQUEST_REJECTED` and `connecting` back to `false`
- [ ] `disconnect()` clears the persisted session
- [ ] `availableWallets` excludes adapters whose `isAvailable()` is false
- [ ] The React `useWallet` tests pass without modification
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

- React hook: `packages/core/src/hooks/useWallet.ts`
- Session storage: `packages/core/src/runtime/walletSession.ts`
- Restore logic already in Vue: `restoreWalletSession` in `packages/vue/src/plugin.ts`
- Registry: `packages/core/src/wallets/registry.ts`

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
