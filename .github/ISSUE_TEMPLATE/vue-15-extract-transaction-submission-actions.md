---
name: "Vue 15: Extract framework-neutral transaction submission actions"
about: Move payment, trustline, and path-payment building, signing, submission, and cache invalidation out of React hooks into shared actions.
title: "refactor(core): extract sendPayment, addTrustline, and pathPayment actions"
labels: enhancement, vue, framework-agnostic, refactor
---

## Extract framework-neutral transaction submission actions

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-02`

---

### Context

`useSendPayment`, `useAddTrustline`, and `usePathPayment` build a
`TransactionBuilder`, resolve the fee via `resolveFee`, sign through the wallet
adapter with the provider passphrase, submit to Horizon, map submission errors,
and invalidate the account cache — all inside `useCallback` bodies.

Extract each into an async action `sendPayment(runtime, options)` etc. that
reads the network config, wallet, and `QueryStore` from the runtime. React and
Vue keep only their own `loading`/`error`/`result` state.

---

### Why this matters

These are the money-moving paths. The passphrase used for signing, the fee
policy, and the 504 double-send protection (`core-07`) must be identical in
every framework. Duplicating them is how a Vue user ends up signing a mainnet
transaction with a testnet fee policy or re-submitting on timeout.

---

### Where this lives

- New: `packages/core/src/actions/sendPayment.ts`
- New: `packages/core/src/actions/addTrustline.ts`
- New: `packages/core/src/actions/pathPayment.ts`
- New: `packages/core/src/actions/*.test.ts`
- Update: `packages/core/src/hooks/useSendPayment.ts`, `useAddTrustline.ts`, `usePathPayment.ts`
- Update: `packages/core/src/core.ts`

---

### Implementation guidelines

- Each action takes the runtime (or a narrow `{ networkConfig, wallet,
queryStore }` view) and the existing options type; it returns the existing
  result type.
- Move validation, fee resolution, memo handling, `setTimeout(30)`, signing,
  submission, error mapping, and `queryStore.invalidate(accountKey(...))`
  verbatim.
- Refactor the three React hooks to call the actions; keep `loading`, `error`,
  `result`, and `reset` in the hooks.
- Keep the existing `useSendPayment.504` and `.xdr` tests green.

---

### Acceptance criteria

- [ ] Actions are tested in plain TypeScript with a fake adapter and mocked Horizon
- [ ] Signing always uses the runtime’s resolved `networkPassphrase`
- [ ] Fee precedence (`fee` > `feeMultiplier` > default) is unchanged
- [ ] The account cache is invalidated after success and not after failure
- [ ] Existing send, trustline, and path-payment tests pass unchanged
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Current hooks: `packages/core/src/hooks/useSendPayment.ts`, `useAddTrustline.ts`, `usePathPayment.ts`
- Fee policy: `packages/core/src/utils/fees.ts`
- Timeout safety: `core-07`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not change fee defaults, timeouts, or error codes in this issue.
- Do not import React or Vue from `packages/core/src/runtime`, `queries`, or
  `actions`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
