---
name: "Enhancement: full memo support in useSendPayment"
about: Text-only memos silently lose exchange deposits — support id, hash and return, and honour SEP-29
title: "feat(core): full memo type support (id/hash/return) and SEP-29 memo-required checks"
labels: enhancement, bug, help wanted
---

## Full memo support in `useSendPayment`

**Complexity:** Medium (100 points)
**Estimated time:** 2 days

---

### Context

`useSendPayment` accepts a memo, and turns every one of them into a **text** memo:

```ts
// packages/core/src/hooks/useSendPayment.ts:90-92
if (options.memo) {
  builder.addMemo(Memo.text(options.memo))
}
```

The type is equally narrow (`types/index.ts:172`):

```ts
memo?: string
```

Stellar has four memo types: `MEMO_TEXT`, `MEMO_ID`, `MEMO_HASH`, and
`MEMO_RETURN`. This hook can produce exactly one of them.

Notably, the library already *reads* the other types — `NormalizedTransaction`
carries both `memo` and `memoType` (`types/index.ts:288-289`). It can tell you a
transaction used `MEMO_ID`. It cannot send one.

---

### Why this matters

**Nearly every exchange deposit address requires `MEMO_ID`.** Binance, Kraken,
Coinbase and the rest pool customer funds in one Stellar account and use a numeric
memo to work out whose deposit just arrived.

Send to one of those addresses with a *text* memo containing the right number and
the transaction succeeds on-chain, the money leaves, and the exchange's crediting
logic — which looks for `MEMO_ID` — does not match it. The funds sit in the
exchange's omnibus account. Recovery means a support ticket, proof of the
transaction, and weeks of waiting. Often the funds are simply gone.

There is a second failure right next to it. `Memo.text()` **throws** when the
string exceeds 28 bytes of UTF-8 — and note that is *bytes*, so a 15-character
string with emoji is over the limit. That throw lands in the generic `catch` at
`useSendPayment.ts:116-119`, gets run through `toStellarError`, and reaches the
user as `UNKNOWN: An unknown error occurred.` The actual problem — "your memo is
too long" — is entirely recoverable, and the user is told nothing.

---

### Where this lives

- `packages/core/src/hooks/useSendPayment.ts`
- `packages/core/src/types/index.ts` (`SendPaymentOptions`)
- `packages/core/src/errors/codes.ts` (new codes)
- `packages/core/src/hooks/useSendPayment.test.tsx`
- `docs/hooks/use-send-payment.md`

---

### Suggested API

Backwards compatible — a bare string stays `MEMO_TEXT`:

```ts
export type MemoInput =
  | string
  | { type: "text"; value: string }
  | { type: "id"; value: string }
  | { type: "hash"; value: string }    // 64 hex chars
  | { type: "return"; value: string }  // 64 hex chars

export interface SendPaymentOptions {
  to: string
  asset: Asset
  amount: string
  memo?: MemoInput
}
```

---

### Implementation guidelines

- **Validate before building, not by catching.** Each type has a specific rule:
  - `text` — ≤ 28 **bytes** UTF-8. Measure bytes (`new TextEncoder().encode(v).length`),
    not `.length`.
  - `id` — an unsigned 64-bit integer *as a string*. It must stay a string all the
    way to `Memo.id()`. Do not parse it to a JavaScript `number`: `2^53` is the
    limit of exact integer representation and memo IDs above it get silently
    rounded to a different number, which reintroduces the exact "credited to the
    wrong account" failure this issue exists to fix.
  - `hash` / `return` — exactly 64 hexadecimal characters (32 bytes).
- Raise a distinct, actionable error for each — `INVALID_MEMO` with a message that
  names the actual limit and what was supplied. Coordinate with `core-05`, which is
  expanding `STELLAR_ERROR_CODES`; add the code there rather than inventing a
  parallel mechanism.
- **Implement the SEP-29 memo-required check.** Before submitting, load the
  destination account and look for a data entry named `config.memo_required`. If it
  is present and no memo was supplied, refuse with a `MEMO_REQUIRED` error rather
  than broadcasting a payment that will not be credited. This is the standard
  wallet-side protection and it is exactly the case where a library saves a user's
  money.
  - The account load is one extra Horizon call per send. Skip it when a memo *was*
    supplied, and skip it when the destination is a muxed (`M...`) address, where
    the memo is already encoded in the address.
- **A muxed destination plus an explicit memo is an error,** not a merge. The
  protocol rejects it; catch it before the round trip.
- Keep the bare-string path working exactly as it does today — existing callers must
  not break, and a test should pin that.
- Update `docs/hooks/use-send-payment.md` with a prominent note about exchange
  deposits requiring `id`. That documentation line is worth as much as the code.

---

### Acceptance criteria

- [ ] All four memo types build correctly and appear on the submitted transaction
- [ ] `memo: "hello"` still produces `MEMO_TEXT` — no breaking change
- [ ] A `text` memo over 28 **bytes** fails validation with a clear message before
      any network call, not as `UNKNOWN`
- [ ] A multi-byte (emoji/CJK) memo is measured in bytes, and a test proves it
- [ ] An `id` memo is carried as a string end-to-end; a test uses a value above
      `Number.MAX_SAFE_INTEGER` and asserts the exact value on the built transaction
- [ ] Non-numeric `id`, and `hash`/`return` that are not 64 hex chars, are rejected
      with `INVALID_MEMO`
- [ ] Sending to an account with `config.memo_required` and no memo fails with
      `MEMO_REQUIRED` **before** submission
- [ ] The memo-required lookup is skipped when a memo is present or the destination
      is muxed
- [ ] A muxed destination combined with an explicit memo is rejected
- [ ] `docs/hooks/use-send-payment.md` documents the exchange-deposit case
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

- The text-only memo: `packages/core/src/hooks/useSendPayment.ts:90-92`
- The narrow type: `packages/core/src/types/index.ts:172`
- Where the throw is swallowed: `packages/core/src/hooks/useSendPayment.ts:116-119`
- Memo types are already read here: `packages/core/src/types/index.ts:288-289`
- Related: `core-05` (error codes), `bug-05`, `bug-09`, `bug-10` (same file)
- Memos: https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/memos
- SEP-29: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md

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
