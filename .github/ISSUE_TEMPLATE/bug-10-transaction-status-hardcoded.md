---
name: "Bug 10: Write hooks always report success"
about: The submit response's `successful` flag is never read, so failed operations show as success
title: "fix(hooks): derive transaction status from the submit response"
labels: bug, critical
---

## Derive transaction status from the submit response

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

Submitting a transaction to Horizon has **two** independent outcomes:

1. Did Horizon accept and include the transaction in a ledger? (HTTP status)
2. Did the operations inside it succeed? (`successful` in the response body)

These come apart routinely. Horizon returns **HTTP 200 with `successful: false`**
when a transaction was included in a ledger but its operations failed —
`op_underfunded`, `op_no_trust`, `op_no_destination`. The user paid the fee, the
transaction is on the ledger permanently, and nothing they wanted to happen
happened.

The SDK does not throw for this case. It resolves.

---

### The defect

`packages/core/src/hooks/useSendPayment.ts:107-115`

```ts
const res = await server.submitTransaction(signed)

const outcome: SendPaymentResult = {
  hash: res.hash,
  status: "success",
}

setResult(outcome)
return outcome
```

`res.successful` is never read. `status` is a string literal. The identical
pattern exists in `useAddTrustline.ts`.

`TransactionStatus` includes `"failed"` (`types/index.ts`), and `useTransaction.ts:58`
derives it correctly from the same field:

```ts
const status: TransactionStatus = raw.successful ? "success" : "failed"
```

So the read path gets this right and the write path does not.

---

### Why this matters

A payments UI shows a green checkmark for a payment that did not happen. The user
believes they sent money. The recipient never receives it. The only way to find
out is to look the transaction up again — through `useTransaction`, which would
have reported `failed` all along.

`op_no_trust` and `op_no_destination` are the two most common first-payment
failures on Stellar, so this is not a rare path.

---

### Where this lives

- Hooks: `packages/core/src/hooks/useSendPayment.ts`,
  `packages/core/src/hooks/useAddTrustline.ts`
- Errors: `packages/core/src/errors/factory.ts`
- Types: `packages/core/src/types/index.ts` (`SendPaymentResult`, `TransactionStatus`)
- Tests: `packages/core/src/hooks/useSendPayment.test.tsx`,
  `packages/core/src/hooks/useAddTrustline.test.tsx`

---

### Implementation guidelines

- Derive `status` from `res.successful`, exactly as `useTransaction.ts:58` does.
- When `successful` is false, read `res.extras?.result_codes` and throw a
  `StellarError` carrying the specific operation code. `toStellarError` already
  knows how to map `op_no_trust` and `op_underfunded` from a `result_codes` object
  (`errors/factory.ts:66-80`) — but it reads them from `error.response.data.extras`,
  and here they arrive on a **resolved** response, not a thrown error. You will
  need to either shape the value so `toStellarError` can classify it, or extract a
  small shared classifier both paths can call. Prefer the shared classifier.
- **Return the hash on the failure path too.** The caller needs it to look the
  transaction up with `useTransaction(hash)` and show the user what actually
  happened. Attach it to the thrown `StellarError` via the existing
  `StellarErrorOptions` (see `errors/StellarError.ts`) rather than inventing a new
  return shape.
- `op_no_destination` and the other codes from **`core-05`** are not in
  `errors/codes.ts` yet, so they will classify as `TRANSACTION_FAILED` until that
  issue lands. That is acceptable — do not add codes here; rebase on `core-05`
  when it merges. The structured-reading work is **`core-06`**.
- Fix both write hooks in one PR. They are structurally identical.

---

### Acceptance criteria

- [ ] A mocked submit returning
      `{ successful: false, extras: { result_codes: { operations: ["op_no_trust"] } } }`
      produces `status: "failed"` and a `StellarError` with code `NO_TRUSTLINE`
- [ ] A mocked submit returning `{ successful: true }` still produces `status: "success"`
- [ ] The transaction hash is available to the caller on the failure path
- [ ] `useSendPayment` and `useAddTrustline` both fixed
- [ ] No code path can return `status: "success"` without having read `res.successful`
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] Every example and test uses **testnet only** — no mainnet addresses
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- The defect: `packages/core/src/hooks/useSendPayment.ts:107-115`
- The read path that does it correctly: `packages/core/src/hooks/useTransaction.ts:58`
- Existing `result_codes` classification: `packages/core/src/errors/factory.ts:66-80`
- Related: `core-05` (the missing codes), `core-06` (structured classification),
  `core-07` (the timeout path on the same submit call)
- Horizon transaction result codes: https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/result-codes/operations

---

### Important rules — read before you start

- **Get assigned first.** Do not open a PR before you are assigned. Unassigned PRs
  are closed without review.
- **Target the `dev` branch.** Branch from `dev` and open your PR against `dev`.
  PRs opened against `main` will not be merged.
- **Make sure CI/CD passes.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` locally and confirm green before pushing.
- **Pull before you push.** `git pull --rebase origin dev` right before pushing.
- **Do not touch files outside your task.** Only the files under "Where this
  lives". Do not reformat, rename, or delete unrelated files.
- **Follow existing conventions** — match the surrounding hooks.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
