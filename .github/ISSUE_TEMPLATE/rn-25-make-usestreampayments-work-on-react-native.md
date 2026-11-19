---
name: "React Native 25: Make useStreamPayments work on React Native"
about: Horizon streaming relies on EventSource, which React Native does not provide; streaming hooks fail on device.
title: "fix(react-native): support Horizon streaming (useStreamPayments) without a browser EventSource"
labels: enhancement, react-native, framework-agnostic, bug
---

## Make useStreamPayments work on React Native

**Complexity:** Very High (300 points)
**Estimated time:** 3 to 4 days

---

### Context

`useStreamPayments` (`packages/core/src/hooks/useStreamPayments.ts`) calls `server.payments().stream()`. The Stellar SDK streams over `EventSource`: in browsers it uses the global, in Node it depends on the `eventsource` package, which needs Node's `http`/`https`. React Native has neither, and `packages/react-native/src/polyfills.ts` installs crypto, Buffer, URL and TextEncoder — not EventSource.

---

### Why this matters

Live payment notifications are a core mobile wallet feature, and the hook is re-exported from `@use-stellar/react-native` as if it worked. Today it either throws at import time or never delivers an event.

---

### Where this lives

- `packages/react-native/src/polyfills.ts`
- `packages/react-native/package.json` (optional peer)
- New: `packages/react-native/src/__tests__/useStreamPayments.native.test.tsx`
- `packages/react-native/README.md`

---

### Implementation guidelines

- First confirm the failure in the Expo example on a device or simulator and paste the error into the PR.
- Install an `EventSource` polyfill that works on RN (for example `react-native-sse`) as an **optional** peer, set on `global.EventSource` only when missing, same pattern as the other polyfills.
- Make sure the SDK's stream picks up the global rather than resolving the Node `eventsource` package under Metro; if it does not, configure Metro resolution in the example and document it.
- Close the stream when the app goes to the background and reopen on foreground (AppState) — streams held open in the background are killed by the OS anyway.

---

### Acceptance criteria

- [ ] The Expo example receives a testnet payment through `useStreamPayments`
- [ ] A native test drives the polyfilled EventSource mock and asserts delivery, reconnect and background close
- [ ] `checkStellarRuntime()` reports a missing EventSource
- [ ] README documents the extra install
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

- `packages/core/src/hooks/useStreamPayments.ts`
- `packages/react-native/src/polyfills.ts`
- `packages/react-native/src/platform/assertRuntime.ts`
- react-native-sse: https://github.com/binaryminds/react-native-sse

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
