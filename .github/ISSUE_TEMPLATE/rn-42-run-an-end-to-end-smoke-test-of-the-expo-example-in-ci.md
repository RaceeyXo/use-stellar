---
name: "React Native 42: Run an end-to-end smoke test of the Expo example in CI"
about: Add a Maestro (or Detox) flow that launches the example and checks a testnet balance renders.
title: "ci(react-native): add an end-to-end smoke test for the Expo example"
labels: enhancement, react-native, framework-agnostic, ci
---

## Run an end-to-end smoke test of the Expo example in CI

**Complexity:** Very High (300 points)
**Estimated time:** 3 to 4 days

---

### Context

React Native tests run in Jest with mocks. Nothing launches the real app, so a polyfill-order bug or Metro resolution error only shows up on a developer's device.

---

### Why this matters

A single launch-and-render check catches the class of bugs Jest mocks hide (the Hermes globals, native module linking).

---

### Where this lives

- New: `examples/react-native-expo/e2e/**`
- `.github/workflows/` (new job, manual or nightly)

---

### Implementation guidelines

- Prefer Maestro (no native build changes). Flow: launch, see the balance of a fixed testnet account, no red box.
- Run nightly and on `workflow_dispatch`, not on every PR — emulator jobs are slow.
- Document how to run it locally.

---

### Acceptance criteria

- [ ] The flow passes locally on an Android emulator
- [ ] The CI job runs nightly and can be triggered manually
- [ ] A broken polyfill import makes it fail
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

- Maestro: https://maestro.mobile.dev
- `examples/react-native-expo`

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
