---
name: "React Native 05: Add a runtime online manager for connectivity-aware fetching"
about: Pause fetches and polling while offline and refetch stale data on reconnect, with platform-supplied connectivity signals.
title: "feat(core): add a runtime online manager for connectivity-aware queries"
labels: enhancement, react-native, framework-agnostic, refactor
---

## Add a runtime online manager for connectivity-aware fetching

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-04`

---

### Context

When a phone loses connectivity, every hook request fails and surfaces a network
error, polling continues to fail, and nothing refetches when the connection
returns.

Add an `onlineManager` to the runtime. Web uses `navigator.onLine` plus
`online`/`offline` events; RN wires it to `@react-native-community/netinfo` in
`rn-07`.

---

### Why this matters

Mobile users move between networks constantly. Showing a hard error on every
tunnel, then staying stale after reconnect, makes wallets feel broken.

---

### Where this lives

- New: `packages/core/src/runtime/onlineManager.ts`
- New: `packages/core/src/runtime/onlineManager.test.ts`
- Update: `packages/core/src/cache/observer.ts`
- Update: polling hooks touched by `rn-04`

---

### Implementation guidelines

- While offline, skip new query fetches and keep cached data visible; do not
  overwrite data with an offline error.
- On reconnect, refetch stale subscribed queries once.
- Write actions (payments) must still fail fast offline with a clear
  `StellarError` — never queue a signed transaction for later.
- Keep today’s web behavior when online.

---

### Acceptance criteria

- [ ] Going offline pauses fetches and polling without clearing data
- [ ] Reconnecting refetches stale queries exactly once
- [ ] Write actions fail fast offline and are never queued
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Focus manager: `rn-04`
- Stale-while-revalidate: `state-02`
- Submission safety: `core-07`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not import `react-native` or any RN library from `packages/core`.
- Never queue or replay signed transactions automatically.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
