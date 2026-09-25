---
name: "React Native 02: Support async storage adapters for wallet sessions"
about: Let the shared wallet-session utility persist through an async key-value store such as AsyncStorage or SecureStore.
title: "feat(core): accept async storage adapters for wallet session persistence"
labels: enhancement, react-native, framework-agnostic, refactor
---

## Support async storage adapters for wallet sessions

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-03`, `rn-01`

---

### Context

Wallet sessions are persisted with synchronous
`window.localStorage`/`sessionStorage`, selected by `autoConnect.storage:
"local" | "session"`. React Native has no Web Storage; its stores
(`@react-native-async-storage/async-storage`, `expo-secure-store`) are
asynchronous.

Extend the session utility extracted in `vue-03` to accept a
`SessionStorageAdapter` with `getItem`, `setItem`, and `removeItem` that may
return promises.

---

### Why this matters

Without async storage, autoConnect cannot work on mobile at all. Solving it in
the shared utility means React, Vue, and RN keep the same validation of stored
sessions — which matters because stored values are untrusted input.

---

### Where this lives

- Update: `packages/core/src/runtime/walletSession.ts`
- Update: `packages/core/src/runtime/walletSession.test.ts`
- Update: `packages/core/src/types/index.ts` (`AutoConnectOptions.storage` accepts an adapter)
- Update: `packages/core/src/hooks/useWallet.ts`

---

### Implementation guidelines

- Keep `"local"` and `"session"` working exactly as today.
- Allow `storage` to be a `SessionStorageAdapter`; normalize sync and async
  adapters behind one async API.
- Keep the stored-session validation (wallet must be registered, address must be
  a string) unchanged.
- Swallow storage failures as today — losing a session must never break the app.

---

### Acceptance criteria

- [ ] Sync Web Storage behavior is unchanged
- [ ] An async in-memory adapter restores and clears sessions
- [ ] Malformed stored JSON is discarded for both adapter kinds
- [ ] Storage exceptions and rejected promises never surface to the UI
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Session utility: `vue-03`
- Current persistence: `packages/core/src/hooks/useWallet.ts` (`readSession`, `writeSession`)
- AsyncStorage: https://react-native-async-storage.github.io/async-storage/

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not import `react-native` or any RN library from `packages/core`.
- Never persist secret material; sessions hold wallet type and optional public
  address only.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
