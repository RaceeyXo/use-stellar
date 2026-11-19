---
name: "React Native 37: Verify the New Architecture and the latest Expo SDK"
about: Prove the package works with Fabric/bridgeless and the current Expo SDK, and pin that in CI.
title: "test(react-native): verify @use-stellar/react-native on the New Architecture and latest Expo SDK"
labels: enhancement, react-native, framework-agnostic, testing
---

## Verify the New Architecture and the latest Expo SDK

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

The package declares `react-native >= 0.68`, but recent React Native versions enable the New Architecture (bridgeless) by default, and Expo SDK upgrades change Metro's resolution of `exports`/`react-native` conditions. Nothing checks either.

---

### Why this matters

Most new apps start on the latest Expo with the New Architecture on. If the polyfills or Metro conditions break there, the first experience is a red screen.

---

### Where this lives

- `examples/react-native-expo/**`
- `packages/react-native/scripts/**` (Metro bundle check)
- `.github/workflows/` (the RN job only)

---

### Implementation guidelines

- Upgrade the example to the current Expo SDK with the New Architecture enabled.
- Extend the existing Metro bundle test to bundle the example for iOS and Android and fail on resolution errors.
- Record the supported version matrix in the README.

---

### Acceptance criteria

- [ ] The example bundles for both platforms on the latest Expo SDK in CI
- [ ] README lists the tested RN/Expo versions
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

- `examples/react-native-expo`
- Expo New Architecture: https://docs.expo.dev/guides/new-architecture/

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
