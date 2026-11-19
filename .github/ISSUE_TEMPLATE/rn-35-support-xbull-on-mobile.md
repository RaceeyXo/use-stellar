---
name: "React Native 35: Support xBull on mobile"
about: The xBull adapter targets the browser; add a mobile path through xBull's app.
title: "feat(react-native): connect and sign with the xBull mobile app"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Support xBull on mobile

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

`packages/core/src/wallets/xbullAdapter.ts` uses `@creit.tech/xbull-wallet-connect`, which opens a browser window. On React Native there is no window, so xBull reports unsupported.

---

### Why this matters

xBull is popular with power users and has a mobile app; supporting it widens wallet coverage on native.

---

### Where this lives

- `packages/core/src/wallets/xbullAdapter.ts`
- `packages/react-native/src/wallets/` (mobile path + test)
- `packages/react-native/README.md`

---

### Implementation guidelines

- Research whether xBull mobile uses WalletConnect or its own deep-link protocol and document the finding in the PR before coding.
- Reuse `registerPendingRequest` for the deep-link return.
- Platform detection must come from the provider's `platform` capabilities, not `typeof window` checks scattered in the adapter.

---

### Acceptance criteria

- [ ] Connect + sign work against a mocked xBull deep link
- [ ] Web behaviour unchanged (existing xBull tests pass)
- [ ] README documents setup
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

- `packages/core/src/wallets/xbullAdapter.ts`
- `packages/react-native/src/platform/deepLinkHandler.ts`

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
