---
name: "Vue 19: Add wallet session restore (autoConnect) to the Vue adapter"
about: Bring the React autoConnect behavior to Vue using the shared wallet-session utility: silent reconnect when allowed, restored intent otherwise.
title: "feat(vue): support autoConnect session restore in useWallet"
labels: enhancement, vue, framework-agnostic
---

## Add wallet session restore (autoConnect) to the Vue adapter

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-03`, `vue-08`

---

### Context

React’s `useWallet` restores a previous session on mount when the provider
enables `autoConnect`: it reconnects only when `adapter.canAutoConnect()` says
no prompt will appear, otherwise it exposes `restoredWallet` so the UI can
pre-select it. `vue-08` explicitly left this out of scope.

Implement the same behavior for Vue using the persistence utility extracted in
`vue-03`.

---

### Why this matters

An autoconnect that pops an approval dialog on every page load is worse than
none. Getting the silent-versus-intent rule identical across frameworks protects
users of both.

---

### Where this lives

- Update: `packages/vue/src/plugin.ts` (accept `autoConnect` options)
- Update: `packages/vue/src/useWallet.ts`
- New: `packages/vue/src/useWallet.autoconnect.test.ts`

---

### Implementation guidelines

- Run restore once per runtime, not once per `useWallet` call; multiple
  components must not race to reconnect.
- Validate the stored session through the shared utility; unknown wallets are
  discarded.
- Expose `restoredWallet` as a ref with the same meaning as React.
- Skip restore entirely during SSR.
- Persist only wallet type and, when opted in, the public address — never
  secrets.

---

### Acceptance criteria

- [ ] Silent-capable adapters reconnect on startup without calling a prompting path
- [ ] Prompting adapters restore intent only and populate `restoredWallet`
- [ ] Unavailable wallets keep stored intent; broken sessions are cleared
- [ ] Two `useWallet` consumers trigger exactly one restore
- [ ] No storage access happens during SSR
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useWallet.ts` (session restore effect)
- Session utility: `vue-03`
- Autoconnect design: `hook-use-wallet-autoconnect-and-adapters`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Never persist secret material.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
