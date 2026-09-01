---
name: "Vue 03: Extract wallet-session persistence into a runtime utility"
about: Make safe wallet-session serialization and storage access reusable by React and Vue without browser-global coupling.
title: "feat(core): extract framework-neutral wallet session persistence"
labels: enhancement, vue, framework-agnostic
---

## Extract wallet-session persistence into a runtime utility

**Complexity:** Medium (100 points)
**Estimated time:** 1 day
**Depends on:** `vue-02`

---

### Context

Wallet session restoration is currently tied to the React provider and
`useWallet`. Vue needs the same safe persistence rules, but shared code must not
read `localStorage` directly or rely on a component lifecycle.

---

### Why this matters

One serializer and storage boundary keeps session data compatible across adapters
and prevents SSR failures, private-mode storage exceptions, or unsafe persisted
wallet values from being handled differently in Vue.

---

### Where this lives

- New: `packages/core/src/runtime/walletSession.ts`
- New: `packages/core/src/runtime/walletSession.test.ts`
- Update: `packages/core/src/hooks/useWallet.ts`
- Update: `packages/core/src/context/StellarProvider.tsx`
- Update: `packages/core/src/index.ts`

---

### Implementation guidelines

- Define a minimal storage interface instead of importing `window.localStorage`.
- Export read, write, and clear helpers for the existing wallet-session key.
- Validate stored values before use and treat malformed or unavailable storage as
  a safe no-session result.
- Preserve the current opt-in autoconnect behavior; do not add a Vue package yet.
- Keep secrets and signing material out of the persisted payload.

---

### Acceptance criteria

- [ ] Storage helpers run in Node with an injected in-memory storage adapter
- [ ] Corrupt, unknown, and unavailable storage states fail safely
- [ ] Only approved wallet-session fields are persisted
- [ ] Existing React autoconnect behavior uses the shared helpers
- [ ] No runtime module imports React, Vue, or browser globals
- [ ] `pnpm lint`, `pnpm typecheck`, and the affected tests pass

---

### Reference

- Session key and provider options: `packages/core/src/context/StellarProvider.tsx`
- Connection lifecycle: `packages/core/src/hooks/useWallet.ts`
- Wallet registry validation: `packages/core/src/wallets/registry.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Keep storage access SSR-safe and catch storage exceptions.
- Do not persist keys, tokens, or signing material.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.

