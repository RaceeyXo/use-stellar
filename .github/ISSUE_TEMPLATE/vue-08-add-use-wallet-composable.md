---
name: "Vue 08: Add a Vue useWallet composable"
about: Port the essential wallet connect, disconnect, and state flow to Vue on top of the shared runtime and wallet adapter registry.
title: "feat(vue): add a wallet composable backed by the shared runtime"
labels: enhancement, vue, framework-agnostic
---

## Add a Vue useWallet composable

**Complexity:** High (150 points)
**Estimated time:** 1 day
**Depends on:** `vue-03`, `vue-07`

---

### Context

Wallet adapters and state types are already reusable, but the public connection
flow only exists in React’s `useWallet`. Implement the focused Vue equivalent
using the shared runtime rather than a Vue-only wallet store.

---

### Why this matters

Wallet connection is the first interactive API most Vue users need. Sharing the
adapter registry means supported wallets, errors, and connection rules remain
consistent between React and Vue.

---

### Where this lives

- New: `packages/vue/src/useWallet.ts`
- New: `packages/vue/src/useWallet.test.ts`
- Update: `packages/vue/src/index.ts`
- Update: shared runtime types only if a narrow missing API is identified

---

### Implementation guidelines

- Implement connect, disconnect, availability, connecting state, wallet state,
  and adapter errors using `getWalletAdapter` and the installed runtime.
- Return Vue refs/computed values with the same semantic fields as the React API
  where practical; document intentional differences.
- Include stale-operation protection so an older async connect cannot overwrite a
  later disconnect or connect attempt.
- Keep autoconnect, extension event subscriptions, and unsupported adapter work
  out of scope for this issue.
- Test with a fake registered adapter; do not require a browser wallet.

---

### Acceptance criteria

- [ ] Vue callers can connect and disconnect through a registered adapter
- [ ] Connected, connecting, address, wallet, and error state update reactively
- [ ] An adapter error is surfaced without leaving `connecting` stuck true
- [ ] A stale connect result cannot overwrite a later disconnect
- [ ] Tests use a fake adapter and no real wallet extension
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useWallet.ts`
- Adapter registry: `packages/core/src/wallets/registry.ts`
- Shared wallet state: `packages/core/src/types/index.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Use the shared runtime and registry; do not duplicate adapter state in Vue.
- Do not persist secrets or require a browser wallet in tests.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.

