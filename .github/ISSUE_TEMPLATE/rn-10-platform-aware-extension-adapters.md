---
name: "React Native 10: Make browser-extension wallet adapters platform-aware"
about: Report extension and popup wallets as unavailable on native with an actionable error instead of crashing on missing globals.
title: "fix(wallets): make extension and popup adapters report native as unsupported"
labels: enhancement, react-native, framework-agnostic, wallets
---

## Make browser-extension wallet adapters platform-aware

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-01`

---

### Context

Freighter (extension), Albedo (web popup), and other browser wallets cannot run
inside a native app. Today their adapters assume a browser, so calling them on
RN throws low-level errors instead of the `wallet_unavailable` code the UI can
handle.

---

### Why this matters

Connect pickers built with `getWalletAdapters()` must be able to hide or explain
unavailable wallets per platform. That needs adapters to report platform
support, not crash.

---

### Where this lives

- Update: `packages/core/src/wallets/types.ts` (optional `metadata.platforms`)
- Update: `packages/core/src/wallets/freighterAdapter.ts`
- Update: `packages/core/src/wallets/albedoAdapter.ts`
- Update: `packages/core/src/wallets/registry.ts`
- New: platform tests for each adapter

---

### Implementation guidelines

- Add an optional `platforms?: ("web" | "native")[]` to adapter metadata;
  missing means web-only for existing adapters.
- `isAvailable()` returns `false` and `connect()` throws `wallet_unavailable`
  with a mobile-specific message on native.
- Do not import extension SDKs at module scope on native paths.
- Keep web behavior unchanged.

---

### Acceptance criteria

- [ ] On a native runtime, Freighter and Albedo report unavailable without throwing
- [ ] `connect()` rejects with `wallet_unavailable` and an actionable message
- [ ] Web behavior and tests are unchanged
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Adapters: `packages/core/src/wallets/`
- Error mapping: `core-04`
- Platform capabilities: `rn-01`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not import `react-native` or any RN library from `packages/core`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
