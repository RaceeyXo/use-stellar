---
name: "React Native 33: Replace the LOBSTR placeholder with a WalletConnect-backed adapter"
about: connect('lobstr') still fails with WALLET_UNSUPPORTED; LOBSTR supports WalletConnect, so give it a real adapter.
title: "feat(wallets): connect LOBSTR through WalletConnect instead of the unsupported placeholder"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Replace the LOBSTR placeholder with a WalletConnect-backed adapter

**Complexity:** High (200 points)
**Estimated time:** 2 to 3 days

---

### Context

`packages/core/src/wallets/registry.ts` registers `lobstr: createUnsupportedAdapter("lobstr", "LOBSTR")`, and the README lists LOBSTR as *Planned*. LOBSTR is the most used Stellar mobile wallet and supports WalletConnect v2, which both the web (`createWalletConnectAdapter`) and native (`createReactNativeWalletConnectAdapter`) adapters already implement.

---

### Why this matters

"Connect with LOBSTR" is the first thing a mobile Stellar user looks for.

---

### Where this lives

- `packages/core/src/wallets/registry.ts`
- New: `packages/core/src/wallets/lobstrAdapter.ts` + test
- `packages/react-native/src/wallets/walletConnect.ts`
- `packages/core/README.md` (Supported wallets)

---

### Implementation guidelines

- Build the adapter as a preset over the WalletConnect adapter (metadata, icon, LOBSTR's deep-link scheme), not a new protocol implementation.
- On native, open the LOBSTR app directly with its WalletConnect deep link; on web, show the QR/URI flow.
- It needs a WalletConnect project ID — fail with a clear configuration error when none is set.

---

### Acceptance criteria

- [ ] `connect("lobstr")` no longer returns `WALLET_UNSUPPORTED` when a project ID is configured
- [ ] Without a project ID the error says how to configure one
- [ ] README marks LOBSTR supported with setup steps
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

- `packages/core/src/wallets/walletConnectAdapter.ts`
- `packages/react-native/src/wallets/walletConnect.ts`
- LOBSTR WalletConnect docs: https://lobstr.co

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
