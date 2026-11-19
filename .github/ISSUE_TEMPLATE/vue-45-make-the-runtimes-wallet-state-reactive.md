---
name: "Vue 45: Make the runtime's wallet state reactive"
about: runtime.wallet is a plain property, so nothing in a component updates when a wallet connects or disconnects.
title: "fix(vue): make runtime.wallet reactive so components update on connect and disconnect"
labels: enhancement, vue, framework-agnostic, bug
---

## Make the runtime's wallet state reactive

**Complexity:** High (200 points)
**Estimated time:** 1 to 2 days

---

### Context

`createStellarRuntime` (`packages/vue/src/plugin.ts`) stores the wallet as a plain object property and `setWallet` simply reassigns it:

```ts
wallet: { ...DISCONNECTED_WALLET, ... },
setWallet(wallet) { runtime.wallet = wallet; walletAddress.value = wallet.address },
```

Only `walletAddress` is a ref. A template or `computed` that reads `runtime.wallet.connected`, `walletName` or `walletNetwork` never re-renders when the wallet changes, because Vue cannot track a plain property on a non-reactive object.

---

### Why this matters

Every wallet UI — a connect button, a "wrong network" banner, a disabled Send button — depends on wallet state being reactive. This is also the foundation `useWallet` (vue-46) needs; building it on a non-reactive field would bake the bug in.

---

### Where this lives

- `packages/vue/src/plugin.ts`
- `packages/vue/src/plugin.test.ts` (new)
- `packages/vue/src/nuxt/runtime/plugin.ts` (if it reads `runtime.wallet`)

---

### Implementation guidelines

- Hold the wallet in a `shallowRef<WalletState>` and expose it **read-only** (`Readonly<Ref<WalletState>>` or a `computed`). Writes go through `setWallet` only.
- Derive `walletAddress` from the wallet ref rather than keeping two sources of truth that can drift; keep `setWalletAddress` working for read-only (watch-address) use.
- The write composables pass `runtime.wallet` to core actions — make sure they read the **current** value at call time (`runtime.wallet.value`), not a value captured at setup.
- This changes the `StellarRuntime` type. It is pre-1.0 and the README never documented reading `runtime.wallet` directly, but call the change out in `CHANGELOG.md` under Unreleased.

---

### Acceptance criteria

- [ ] A component rendering `runtime.wallet.connected` re-renders after `setWallet` (test with `@vue/test-utils` mount)
- [ ] `useSendPayment().send()` signs with a wallet set **after** the composable was created
- [ ] Consumers cannot mutate the wallet object directly (type-level `Readonly`)
- [ ] `walletAddress` always equals the wallet's address after `setWallet`
- [ ] `CHANGELOG.md` Unreleased notes the type change
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

- `packages/vue/src/plugin.ts` (`createStellarRuntime`, `setWallet`)
- `packages/vue/src/useSendPayment.ts` (reads `runtime.wallet`)
- Vue `shallowRef`: https://vuejs.org/api/reactivity-advanced.html#shallowref

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
