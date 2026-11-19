---
name: "React Native 36: Offer secure storage for the wallet session"
about: Sessions persist in AsyncStorage (unencrypted); add an expo-secure-store / Keychain adapter.
title: "feat(react-native): add a secure-storage adapter for the persisted wallet session"
labels: enhancement, react-native, framework-agnostic
---

## Offer secure storage for the wallet session

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

`createAsyncStorageAdapter` (`packages/react-native/src/platform/asyncStorageSession.ts`) persists the wallet session, including WalletConnect session data, in AsyncStorage, which is unencrypted on Android.

---

### Why this matters

WalletConnect session topics let a device reconnect to the user's wallet. Security-conscious apps (and app-store reviews) expect secrets in the Keychain/Keystore.

---

### Where this lives

- New: `packages/react-native/src/platform/secureStoreSession.ts` + test
- `packages/react-native/src/index.ts`
- `packages/react-native/package.json` (optional peer `expo-secure-store`)
- `packages/react-native/README.md`

---

### Implementation guidelines

- Implement the same `Storage` interface as the AsyncStorage adapter so it is a drop-in.
- Optional peer only; importing the package must not require it.
- Document the size limit of SecureStore values and chunk if the session can exceed it.

---

### Acceptance criteria

- [ ] `createSecureStoreAdapter()` passes the same test suite as the AsyncStorage adapter
- [ ] Package still imports with `expo-secure-store` absent
- [ ] README shows how to opt in
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

- `packages/react-native/src/platform/asyncStorageSession.ts`
- expo-secure-store: https://docs.expo.dev/versions/latest/sdk/securestore/

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
