---
name: "Core 07: A Horizon 504 on submit can cause a double-send"
about: A timeout is reported as a network error, so the user retries a payment that may already be on the ledger
title: "fix(hooks): a Horizon 504 on submit can cause a double-send"
labels: bug, critical, security
---

## A Horizon 504 on submit can cause a double-send

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days
**Depends on:** `core-05`

---

### Context

This is *the* classic hazard of submitting to Stellar, and every serious Stellar
client has an answer for it.

`POST /transactions` is synchronous: Horizon holds the connection open while it
waits for the transaction to be included in a ledger. Ledgers close every ~5
seconds, but under load Horizon gives up first and returns **HTTP 504 Gateway
Timeout** — while the transaction is **still in the queue and may well be included
in the very next ledger**.

A 504 therefore means "I don't know", not "it failed". Treating it as a failure is
what causes the double-send.

The protocol's own safeguard is the **sequence number**. A transaction is bound to
one, and the network rejects any second transaction reusing it. So resubmitting
*the identical signed envelope* is safe — it is either the same transaction (a
no-op) or rejected as a duplicate. Building a *new* transaction and signing it
fresh gets a *new* sequence number, and the network will happily execute both.

---

### The defect

`packages/core/src/hooks/useSendPayment.ts:107` submits with no timeout handling
at all:

```ts
const res = await server.submitTransaction(signed)
```

The 504 propagates as a thrown error into the `catch` at line 116, and
`toStellarError` classifies it by message heuristic —
`packages/core/src/errors/factory.ts:109-120` matches `"timeout"` / `"timed out"`
and returns:

```ts
return createStellarError("NETWORK_ERROR", undefined, { raw: error })
```

whose default message is *"Unable to reach the Stellar network. Check your
connection and try again."* (`codes.ts:59`).

So the UI tells the user their connection failed and invites a retry. The retry
path goes through `send()` again, which calls `server.loadAccount` at line 74 —
fetching a **fresh sequence number** — and builds an entirely new transaction. If
the first one landed, the payment goes out twice.

There is also no `tx_bad_seq` handling anywhere, so two components submitting from
the same account concurrently produce an opaque `TRANSACTION_FAILED`.

---

### Why this matters

This is the one bug in the backlog that loses a user real money **with no error
message at any point**. Both transactions succeed. Both appear in the history. The
library reported a network problem and the user did exactly what it suggested.

---

### Where this lives

- Hooks: `packages/core/src/hooks/useSendPayment.ts`,
  `packages/core/src/hooks/useAddTrustline.ts`
- Errors: `packages/core/src/errors/factory.ts`
- Types: `packages/core/src/types/index.ts`
- Docs: `docs/hooks/use-send-payment.md`, `README.md` (troubleshooting table)
- Tests: `packages/core/src/hooks/useSendPayment.test.tsx`

---

### Implementation guidelines

- **On timeout, return the transaction hash with a `TX_TIMEOUT` code.** The hash is
  computable from the signed envelope *before* submission — `tx.hash().toString("hex")`
  on the built transaction — so it is available even when the response never
  arrives. Compute it before `submitTransaction` and carry it through both paths.
- The caller can then poll `useTransaction(hash)` to find out what actually
  happened. That is the whole recovery story and it must be in the docs with a
  worked example, not just implied.
- **Distinguish 504 from a real network failure.** A 504 has a response; a
  connection failure does not. Check `err.response?.status === 504` structurally,
  before the message heuristics — this is exactly the work **`core-06`** is doing to
  that function, so coordinate.
- **Document the resubmit-with-same-envelope rule prominently.** If you offer any
  retry helper, it must resubmit the *identical signed XDR*, never rebuild. Make it
  hard to do the wrong thing: do not expose a retry that takes the original
  `SendPaymentOptions`.
- Add explicit `SEQUENCE_MISMATCH` handling for `tx_bad_seq` with a documented
  retry path — reload the account, rebuild, resign. That *is* safe, because
  `tx_bad_seq` means the transaction definitively did not execute.
- `TX_TIMEOUT` and `SEQUENCE_MISMATCH` are added by **`core-05`**. Land that first.
- Apply the same handling to `useAddTrustline`.

---

### Acceptance criteria

- [ ] A mocked 504 produces `TX_TIMEOUT`, **not** `NETWORK_ERROR`, and carries the
      transaction hash
- [ ] A genuine connection failure (no response object) still produces `NETWORK_ERROR`
- [ ] The hash is computed before submission so it is available on the timeout path
- [ ] A `tx_bad_seq` response produces `SEQUENCE_MISMATCH`
- [ ] Any retry affordance resubmits the identical signed envelope — it is not
      possible to accidentally rebuild with a fresh sequence number
- [ ] `docs/hooks/use-send-payment.md` gains a "what to do on timeout" section with
      a worked `useTransaction(hash)` polling example
- [ ] The README troubleshooting table gains a row for it
- [ ] The same handling applied to `useAddTrustline`
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

- The unguarded submit: `packages/core/src/hooks/useSendPayment.ts:107`
- The misclassification: `packages/core/src/errors/factory.ts:109-120`
- The misleading default message: `packages/core/src/errors/codes.ts:59`
- The recovery hook: `packages/core/src/hooks/useTransaction.ts`
- Related: `core-05` (the codes, land first), `core-06` (structured classification),
  `bug-10` (the `successful: false` path on the same call)
- Stellar's own guidance on this: https://developers.stellar.org/docs/build/apps/example-application-tutorial/handling-errors

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
