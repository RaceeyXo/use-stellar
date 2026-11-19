---
name: "React Native 32: Wire the deep-link handler into the native StellarProvider"
about: Apps must call initDeepLinkHandler themselves; let the provider own it behind a prop.
title: "feat(react-native): let the native StellarProvider own the deep-link handler"
labels: enhancement, react-native, framework-agnostic
---

## Wire the deep-link handler into the native StellarProvider

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

`initDeepLinkHandler` and `registerPendingRequest` (`packages/react-native/src/platform/deepLinkHandler.ts`) are exported, but the native `StellarProvider` never calls them. Every app has to remember to start the handler (and clean it up) itself, or wallet returns are dropped.

---

### Why this matters

A forgotten `initDeepLinkHandler()` produces the worst kind of bug: the wallet signs, the user comes back, and the app waits forever.

---

### Where this lives

- `packages/react-native/src/StellarProvider.tsx`
- `packages/react-native/src/StellarProvider.test.tsx`
- `packages/react-native/README.md`

---

### Implementation guidelines

- Add `deepLinks?: boolean | DeepLinkHandlerOptions` (default `true`) to `NativeStellarProviderProps`; start the handler in an effect and run its cleanup on unmount.
- Calling `initDeepLinkHandler` manually as well must not register two listeners — make it idempotent.

---

### Acceptance criteria

- [ ] Mounting the provider registers exactly one `Linking` listener; unmounting removes it
- [ ] `deepLinks={false}` registers none
- [ ] Manual + provider initialisation does not double-handle a link
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

- `packages/react-native/src/platform/deepLinkHandler.ts`
- `packages/react-native/src/StellarProvider.tsx`

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
