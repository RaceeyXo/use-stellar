---
name: "React Native 31: Support SEP-10 authentication on React Native"
about: useSep10Auth needs a challenge signed by a mobile wallet; verify and adapt it for the WalletConnect hand-off.
title: "feat(react-native): make useSep10Auth work with mobile WalletConnect signing"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Support SEP-10 authentication on React Native

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

`useSep10Auth` (`packages/core/src/hooks/useSep10Auth.ts`) fetches a challenge transaction and asks the wallet to sign it. On mobile the signature comes back through a WalletConnect deep-link round trip that can outlast the challenge's time bounds, and the hook has no native test.

---

### Why this matters

SEP-10 is how users log in to anchors (deposits/withdrawals) — a must-have for mobile on/off-ramp apps.

---

### Where this lives

- `packages/core/src/hooks/useSep10Auth.ts`
- New: `packages/react-native/src/__tests__/useSep10Auth.native.test.tsx`
- `packages/react-native/README.md`

---

### Implementation guidelines

- Test the full flow with the mocked WalletConnect adapter, including a slow signer.
- If the challenge expires during signing, fail with a clear typed error and let the caller retry — do not silently refetch and re-prompt.
- Any fix to the hook itself goes in core (one implementation for web and native).

---

### Acceptance criteria

- [ ] Native test covers success, user rejection and an expired challenge
- [ ] Expired challenge produces a documented error code
- [ ] README shows a SEP-10 login example
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

- `packages/core/src/hooks/useSep10Auth.ts`
- SEP-10: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md

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
