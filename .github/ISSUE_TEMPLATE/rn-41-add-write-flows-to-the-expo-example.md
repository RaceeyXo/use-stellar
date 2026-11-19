---
name: "React Native 41: Add write flows to the Expo example"
about: The Expo example only reads; add connect via WalletConnect, send payment and a Soroban call.
title: "feat(demo): add WalletConnect connect, payment and Soroban flows to the Expo example"
labels: enhancement, react-native, framework-agnostic, demo
---

## Add write flows to the Expo example

**Complexity:** High (200 points)
**Estimated time:** 2 to 3 days
**Depends on:** `rn-33`

---

### Context

`examples/react-native-expo` demonstrates read hooks. It does not connect a wallet or submit anything, so the WalletConnect, deep-link and signing code paths are never exercised on a device.

---

### Why this matters

Those are exactly the paths most likely to break on mobile, and the example is how contributors reproduce bugs.

---

### Where this lives

- `examples/react-native-expo/**`

---

### Implementation guidelines

- Screens: connect (LOBSTR/Freighter Mobile via WalletConnect), balance, send payment, Soroban read + write.
- Read the WalletConnect project ID from an env var; never commit one.
- Testnet only.

---

### Acceptance criteria

- [ ] A payment can be sent from the example on a device via WalletConnect
- [ ] README explains env setup
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

- `examples/react-native-expo/App.tsx`
- `packages/react-native/src/wallets/walletConnect.ts`

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
