---
name: "Vue 35: Add the Vue useSendPayment composable"
about: Port payment submission to Vue using the shared sendPayment action.
title: "feat(vue): add the useSendPayment composable"
labels: enhancement, vue, framework-agnostic
---

## Add the Vue useSendPayment composable

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-08`, `vue-15`

---

### Context

`useSendPayment` sends XLM or an issued asset with an optional memo and fee
overrides, signs through the connected wallet, and invalidates the sender’s
balance cache.

---

### Why this matters

Payment is the flagship write API. Sharing the action guarantees Vue gets the
same fee policy, asset validation, memo rules, and 504 safety as React.

---

### Where this lives

- New: `packages/vue/src/useSendPayment.ts`
- New: `packages/vue/src/useSendPayment.test.ts`
- Update: `packages/vue/src/index.ts`

---

### Implementation guidelines

- Expose `send(options: SendPaymentOptions)`, `loading`, `error`, `result`, and
  `reset` with the same semantics as the React hook.
- Delegate building, fee resolution, signing, submission, and cache invalidation
  to `sendPayment` from the core actions module (`vue-15`); pass the installed
  runtime so the network passphrase and connected wallet come from one source.
- Guard against stale completions: a result from an older call must not
  overwrite state from a newer call or a `reset()`.
- Do not mutate state after the owning effect scope is disposed.

---

### Acceptance criteria

- [ ] `send` builds, signs through the adapter, and submits using the runtime network passphrase
- [ ] `loading` is true only while a call is in flight and never sticks after an error
- [ ] Wallet-not-connected and validation failures reject with the same `StellarError` codes as React
- [ ] The connected account’s balance cache entry is invalidated after success
- [ ] A stale completion cannot overwrite a newer call or a `reset()`
- [ ] Issued-asset and memo payments build the same XDR as React on fixtures
- [ ] Tests use a fake adapter and mocked Horizon; no real wallet or network
- [ ] Vue build, typecheck, and affected tests pass

---

### Reference

- React behavior: `packages/core/src/hooks/useSendPayment.ts`
- Shared submission services: `vue-15`
- Fee policy: `packages/core/src/utils/fees.ts`
- Error model: `packages/core/src/errors/`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Call the shared core services; do not reimplement Stellar, Horizon, or RPC
  logic in `packages/vue`.
- Never sign against a passphrase other than the runtime’s resolved
  `networkPassphrase`.
- Mock Horizon, Soroban RPC, and wallet adapters in tests; make no live network
  calls.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
