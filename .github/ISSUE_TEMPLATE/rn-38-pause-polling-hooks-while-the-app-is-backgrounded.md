---
name: "React Native 38: Pause polling hooks while the app is backgrounded"
about: useContractEvents and useTransaction polling keep timers alive in the background; pause and resume with AppState.
title: "fix(react-native): pause interval polling while the app is in the background"
labels: enhancement, react-native, framework-agnostic
---

## Pause polling hooks while the app is backgrounded

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

The native provider wires AppState into the focus manager so stale queries refetch on foreground. Interval-based polling — `useContractEvents`, `useTransaction` and `watch: true` balances — keeps its timers running in the background, where iOS suspends them unpredictably and Android spends battery and data.

---

### Why this matters

Background network use is a common store-review and battery complaint, and resumed timers can fire a burst of requests at once.

---

### Where this lives

- The polling code in `packages/core/src/hooks/useContractEvents.ts`, `useTransaction.ts`, `useBalance.ts` (via the shared focus manager)
- `packages/react-native/src/__tests__/appstate-acceptance.test.tsx`

---

### Implementation guidelines

- Fix in core: polling should consult the platform focus manager, which the native provider already supplies — no RN-only branch in the hooks.
- On foreground, run one immediate poll and resume the interval; do not replay missed ticks.

---

### Acceptance criteria

- [ ] No poll fires while AppState is `background` (fake timers)
- [ ] Exactly one poll fires on return to `active`
- [ ] Web behaviour unchanged
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

- `packages/react-native/src/platform/appStateFocus.ts`
- `packages/core/src/hooks/useContractEvents.ts`

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
