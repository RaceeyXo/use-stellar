---
name: "Vue 70: Pass transactionTimeout and fee settings through the Vue runtime"
about: The Vue write composables never pass transactionTimeout, so signing slow wallets times out at the 30 s default.
title: "fix(vue): add transactionTimeout to the plugin and pass it to every write action"
labels: enhancement, vue, framework-agnostic, bug
---

## Pass transactionTimeout and fee settings through the Vue runtime

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

`SendPaymentRuntime` in `packages/core/src/actions/sendPayment.ts` accepts `transactionTimeout`, and the React provider has a `transactionTimeout` prop. `packages/vue/src/useSendPayment.ts` builds the runtime object with only `network`, `networkConfig`, `wallet` and `queryStore`, and so do `useAddTrustline` and `usePathPayment`. There is no plugin option for it.

---

### Why this matters

The core README recommends `transactionTimeout: 120` for Trezor and mobile hand-offs. A Vue app cannot follow that advice: hardware-wallet payments expire before the user finishes confirming on the device.

---

### Where this lives

- `packages/vue/src/plugin.ts`
- `packages/vue/src/useSendPayment.ts`
- `packages/vue/src/useAddTrustline.ts`
- `packages/vue/src/usePathPayment.ts`
- their tests
- `packages/vue/README.md`

---

### Implementation guidelines

- Add `transactionTimeout?: number` to `StellarPluginOptions` and `StellarRuntime`, default 30, validated as a positive integer.
- Build the action runtime in **one** helper (e.g. `actionRuntime(runtime)`) used by all three composables, so the next field added is not forgotten in one of them.

---

### Acceptance criteria

- [ ] A test asserts the built transaction's time bounds reflect a configured timeout of 120
- [ ] All three write composables use the shared helper
- [ ] README plugin-options table lists `transactionTimeout`
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

- `SendPaymentRuntime` in `packages/core/src/actions/sendPayment.ts`
- React prop: `packages/core/src/context/StellarProvider.tsx`

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
