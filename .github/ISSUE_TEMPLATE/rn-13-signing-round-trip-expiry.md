---
name: "React Native 13: Prevent transaction expiry during mobile signing round-trips"
about: Stop the hard-coded 30-second transaction timeout from expiring transactions while users approve in a separate wallet app.
title: "fix(core): make transaction time bounds safe for app-switch signing"
labels: enhancement, react-native, framework-agnostic, bug
---

## Prevent transaction expiry during mobile signing round-trips

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-15`, `rn-11`

---

### Context

`useSendPayment`, `useAddTrustline`, and `usePathPayment` call
`.setTimeout(30)`. On desktop the extension popup usually returns within that
window. On mobile, switching to a wallet app, unlocking it with biometrics,
reviewing, and returning often takes longer, so Horizon rejects the transaction
as `tx_too_late`.

Fix this once in the shared actions from `vue-15`: make the time bound come from
runtime configuration with a safe default per platform, and map `tx_too_late` to
a dedicated, actionable error.

---

### Why this matters

An expired transaction looks to users like a failed payment after they approved
it. They retry, and depending on timing that can look like a double charge.
Correct time bounds and a clear error remove the confusion.

---

### Where this lives

- Update: `packages/core/src/actions/*.ts` (from `vue-15`)
- Update: `packages/core/src/runtime/StellarRuntime.ts` (transaction timeout config)
- Update: `packages/core/src/errors/codes.ts` and `factory.ts`
- New: tests for timeout resolution and `tx_too_late` mapping

---

### Implementation guidelines

- Keep 30 seconds as the web default; default native runtimes to a longer bound
  and allow an explicit override.
- Map `tx_too_late` to a distinct `StellarErrorCode` with guidance to retry.
- Never automatically rebuild and resubmit after expiry.
- Coordinate with `core-05` so the new code fits the expanded error set.

---

### Acceptance criteria

- [ ] Web time bounds are unchanged
- [ ] Native runtimes use the longer default; an override is respected
- [ ] `tx_too_late` surfaces as its own error code
- [ ] No automatic resubmission occurs
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Hard-coded bounds: `packages/core/src/hooks/useSendPayment.ts`, `useAddTrustline.ts`, `usePathPayment.ts`
- Error codes: `core-05`
- Submission safety: `core-07`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not import `react-native` or any RN library from `packages/core`.
- Never resubmit signed transactions automatically.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
