---
name: "React Native 04: Add a runtime focus manager for polling and refetch-on-focus"
about: Let platforms signal app foreground/background so polling hooks pause in the background and refresh on return.
title: "feat(core): add a runtime focus manager used by polling hooks"
labels: enhancement, react-native, framework-agnostic, refactor
---

## Add a runtime focus manager for polling and refetch-on-focus

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-11`, `rn-01`

---

### Context

`useBalance`, `useTransaction`, `usePaymentPaths`, and `useContractEvents` poll
with `setInterval`. On mobile, timers keep firing while the app is backgrounded
(burning battery and Horizon quota) or are frozen by the OS and fire in a burst
on resume.

Add a `focusManager` to the runtime with `isFocused()` and `subscribe()`. Web
defaults to `document.visibilityState`; RN wires it to `AppState` in `rn-07`.

---

### Why this matters

Background polling is a common reason for App Store battery complaints and
Horizon rate limiting (`core-08`). Solving it in the runtime means every polling
hook — in every framework — behaves correctly.

---

### Where this lives

- New: `packages/core/src/runtime/focusManager.ts`
- New: `packages/core/src/runtime/focusManager.test.ts`
- Update: polling in `useBalance.ts`, `useTransaction.ts`, `usePaymentPaths.ts`, and the shared contract-event poller
- Update: `packages/core/src/cache/observer.ts` (refetch stale queries on focus)

---

### Implementation guidelines

- Pause interval polling while unfocused; resume with one immediate refetch on
  focus.
- On focus, refetch only subscribed queries that are stale; never refetch fresh
  data.
- Server platforms are always ‘focused’ and never subscribe to anything.
- Keep today’s web behavior identical when the page is visible.

---

### Acceptance criteria

- [ ] Polling stops while unfocused and resumes on focus with a single fetch
- [ ] Only stale subscribed queries refetch on focus
- [ ] No burst of queued fetches occurs on resume
- [ ] Web visibility wiring is covered by tests
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Polling hooks: `packages/core/src/hooks/useBalance.ts`, `useTransaction.ts`, `usePaymentPaths.ts`, `useContractEvents.ts`
- Query observer: `vue-11`
- Rate limits: `core-08`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not import `react-native` or any RN library from `packages/core`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
