---
name: "React Native 34: Add a Freighter Mobile preset"
about: Freighter Mobile connects over WalletConnect; ship a preset so apps don't hand-configure it.
title: "feat(react-native): add a Freighter Mobile WalletConnect preset"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Add a Freighter Mobile preset

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

On web, `freighterAdapter` talks to the browser extension through `@stellar/freighter-api`, which reports native as unsupported. Freighter's mobile app connects through WalletConnect, but there is no preset, so RN users must configure metadata and deep-link schemes by hand.

---

### Why this matters

Freighter is the reference Stellar wallet; RN apps should get it with one line.

---

### Where this lives

- `packages/react-native/src/wallets/` (new preset + test)
- `packages/react-native/src/index.ts`
- `packages/react-native/README.md`

---

### Implementation guidelines

- Same approach as the LOBSTR preset (rn-33): metadata + deep-link scheme over `createReactNativeWalletConnectAdapter`.
- Register under an id that does not clash with the web `freighter` adapter, e.g. `freighter-mobile`, and document why.

---

### Acceptance criteria

- [ ] `connect("freighter-mobile")` opens Freighter via WalletConnect (mocked in tests)
- [ ] README lists it
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

- `packages/react-native/src/wallets/walletConnect.ts`
- Freighter: https://www.freighter.app

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
