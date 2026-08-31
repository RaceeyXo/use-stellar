---
name: "State 06: Soroban transfers render as blank 0 XLM rows"
about: normalizePayment has no branch for invoke_host_function and fabricates a zero-value row
title: "fix(hooks): normalizePayment renders Soroban transfers as blank 0 XLM rows"
labels: bug, hook, soroban
---

## `normalizePayment` renders Soroban transfers as blank 0 XLM rows

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Horizon's `/payments` endpoint returns several different operation types, not just
`payment`. `usePayments` declares the union it expects at
`packages/core/src/hooks/usePayments.ts:14-20`:

```ts
type PaymentRecord =
  | Horizon.ServerApi.PaymentOperationRecord
  | Horizon.ServerApi.CreateAccountOperationRecord
  | Horizon.ServerApi.AccountMergeOperationRecord
  | Horizon.ServerApi.PathPaymentOperationRecord
  | Horizon.ServerApi.PathPaymentStrictSendOperationRecord
  | Horizon.ServerApi.InvokeHostFunctionOperationRecord
```

Six members. `normalizePayment` handles four of them.

---

### The defect

`packages/core/src/hooks/usePayments.ts:143-211`

The function initializes the output fields and then walks a chain of `if`s:

```ts
let from = ""
let to = ""
let amount = "0"
let asset: Asset = "XLM"
let direction: "incoming" | "outgoing" = "outgoing"

if (type === "payment") { … }
else if (type === "create_account") { … }
else if (type === "account_merge") { … }
else if (type === "path_payment_strict_receive" || type === "path_payment_strict_send") { … }

return { id, txHash, type, from, to, amount, asset, direction, createdAt }
```

There is **no branch for `invoke_host_function`**. A Soroban record falls through
all four conditions and returns the initializers verbatim:

```ts
{ from: "", to: "", amount: "0", asset: "XLM", direction: "outgoing" }
```

That is not a failure — it is a fabricated payment record that looks exactly like
a real one to every consumer.

`account_merge` is separately broken. `packages/core/src/hooks/usePayments.ts:173`
hardcodes the amount:

```ts
amount = "0"
```

An account merge transfers the account's **entire remaining balance** to the
destination. Reporting it as zero is wrong for the single largest payment most
accounts ever make.

---

### Why this matters

Every Soroban token transfer in a payment history renders as an empty row: no
sender, no recipient, 0 XLM, outgoing. As Soroban-issued assets grow this becomes
a large fraction of the list for many accounts — and the rows are silently wrong
rather than visibly missing.

`hook-use-stream-payments` is specced to reuse `normalizePayment`, so it inherits
this bug the day it ships unless this lands first.

---

### Where this lives

- Hook: `packages/core/src/hooks/usePayments.ts`
- Types: `packages/core/src/types/index.ts` (`NormalizedPayment`)
- Test: `packages/core/src/hooks/usePayments.test.tsx`
- Fixtures: `packages/core/src/__tests__/fixtures/` (create if absent)

---

### Implementation guidelines

- **Add an explicit `invoke_host_function` branch.** Horizon exposes the actual
  value movement on the operation's `asset_balance_changes` array — each entry
  carries `type`, `from`, `to`, `amount`, and the asset. Extract the transfer that
  involves the queried address; if there is more than one, decide and **document**
  whether you emit one row per change or one summary row. One row per change is
  usually what a history UI wants.
- **Fix `account_merge`.** The merged amount is not on the operation record — it is
  on the operation's **effects** (`account_credited` / `account_debited`). Either
  fetch effects for the operation, or expose the amount as `null` with a documented
  meaning. Do **not** leave a fabricated `"0"`.
- **Never fabricate.** For any record type still unhandled, either filter it out of
  the returned list or return a discriminated `{ type: "unsupported" }` variant so
  consumers can skip it deliberately. Prefer the discriminated variant — silently
  dropping rows makes a history look complete when it is not. Whichever you pick,
  make the fall-through path impossible to reach silently: an `else` that throws or
  returns the unsupported variant, never one that returns initializers.
- Build **committed fixtures** from real testnet Horizon responses — one per member
  of the `PaymentRecord` union. Put them under `src/__tests__/fixtures/` so
  `test-03` can reuse them for its MSW handlers.
- If `NormalizedPayment` gains a variant or `amount` becomes nullable, that is a
  type-level breaking change — note it in `CHANGELOG.md` and update
  `docs/reference/types.md`.

---

### Acceptance criteria

- [ ] `invoke_host_function` records produce real `from` / `to` / `amount` / `asset`
- [ ] `account_merge` reports the actual merged amount, or an explicitly documented `null`
- [ ] **No code path returns a fabricated zero-amount row**
- [ ] Unhandled record types are discriminated or filtered, never silently zeroed
- [ ] A fixture-based test for **each** of the six members of the `PaymentRecord` union
- [ ] Fixtures are real recorded Horizon responses, committed under `src/__tests__/fixtures/`
- [ ] Type changes reflected in `docs/reference/types.md` and `CHANGELOG.md`
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

- The union: `packages/core/src/hooks/usePayments.ts:14-20`
- The normalizer: `packages/core/src/hooks/usePayments.ts:143-211`
- The hardcoded merge amount: `packages/core/src/hooks/usePayments.ts:173`
- Downstream consumer: `hook-use-stream-payments` (land this first)
- Horizon operations reference: https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations
- Soroban asset balance changes: https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/invoke-host-function

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
