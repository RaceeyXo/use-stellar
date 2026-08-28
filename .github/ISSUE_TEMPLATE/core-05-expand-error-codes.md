---
name: "Core 05: Missing the error codes payments actually need"
about: Seven common failures all collapse into TRANSACTION_FAILED with no way to branch
title: "feat(errors): add the error codes payments actually need"
labels: enhancement, good first issue
---

## Add the error codes payments actually need

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

`packages/core/src/errors/codes.ts:8-42` defines twelve error codes. They cover the
wallet lifecycle well and the transaction lifecycle barely. The single code
`TRANSACTION_FAILED` absorbs every on-ledger failure, which means a consumer can
tell that *something* went wrong but never *what*.

Horizon tells you exactly what went wrong. Every failed transaction carries
`extras.result_codes` with a transaction-level code and an array of
operation-level codes. Those are the actionable signal, and the library discards
almost all of them at `packages/core/src/errors/factory.ts:77-79`:

```ts
if (resultCodes.transaction && resultCodes.transaction !== "tx_success") {
  return createStellarError("TRANSACTION_FAILED", undefined, { raw: error })
}
```

---

### The gap

| Missing code | Horizon result code | Why it matters |
|---|---|---|
| `DESTINATION_NOT_FOUND` | `op_no_destination` | The most common first-payment failure — and the one that should prompt a create-account flow |
| `SEQUENCE_MISMATCH` | `tx_bad_seq` | Two concurrent submissions from one account |
| `TX_TIMEOUT` | `tx_too_late` / HTTP 504 | See `core-07` — this one risks a double-send |
| `TRUSTLINE_LIMIT_EXCEEDED` | `op_line_full` | Receiving more than the trust limit allows |
| `SIMULATION_FAILED` | Soroban simulation error | Currently an untyped `new Error` at `useSorobanContract.ts:116,120` |
| `FEE_TOO_LOW` | `tx_insufficient_fee` | Needed by `bug-09` |
| `ASSET_NOT_FOUND` | — | See below |

**Also in scope — two `useAsset` bugs.**

`packages/core/src/hooks/useAsset.ts:69` throws the wrong code for a missing asset:

```ts
throw createStellarError("ACCOUNT_NOT_FOUND", `Asset ${code}:${issuer} not found.`)
```

An asset is not an account. Consumers checking `err.code === "ACCOUNT_NOT_FOUND"`
to offer a create-account flow will offer it for a typo'd asset code.

And `packages/core/src/hooks/useAsset.ts:85-87` sets `error` **without clearing
`asset`**:

```ts
} catch (err) {
  setError(toStellarError(err))
} finally {
```

So switching from a valid USDC to a bogus code leaves USDC's supply, issuer, and
flags on screen next to an error message. The user sees stale data presented as
current. (Note the contrast with `state-02`: there, clearing on *fetch failure* is
wrong. Here the *query changed* — different asset — so clearing is correct. The
rule is "clear when the query changes, keep when a refresh fails".)

---

### Why this matters

`op_no_destination` is what every developer hits on their first payment, because
Stellar accounts do not exist until funded. Today it surfaces as "The transaction
failed on the network." — which tells them nothing and sends them to the Stellar
Discord instead of to `useCreateAccount`.

---

### Where this lives

- Errors: `packages/core/src/errors/codes.ts`, `packages/core/src/errors/factory.ts`
- Hook: `packages/core/src/hooks/useAsset.ts`
- Tests: `packages/core/src/errors/factory.test.ts`,
  `packages/core/src/hooks/useAsset.test.ts`
- Docs: `docs/guides/error-handling.md`, `docs/reference/types.md`

---

### Implementation guidelines

- Add all seven codes to `STELLAR_ERROR_CODES` with a matching entry in
  `DEFAULT_ERROR_MESSAGES` — the `Record<StellarErrorCode, string>` type at
  `codes.ts:48` makes TypeScript enforce that pairing, which is why the file is
  structured that way. Keep the existing grouping comments.
- **Write actionable default messages.** These strings are shown directly in demos
  and often straight to users. "The destination account does not exist yet — it
  must be created and funded before it can receive payments." beats "Destination
  not found."
- Map each from the corresponding `result_codes` value in `factory.ts`, inserting
  the checks **before** the catch-all at line 77. The existing branches at lines
  68-76 show the pattern for both `operations` array membership and
  `transaction` equality.
- **Order matters.** Operation-level codes are more specific than transaction-level
  ones; check operations first. Preserve the existing `op_no_trust` and
  `op_underfunded` branches exactly as they are.
- Fix `useAsset` to throw `ASSET_NOT_FOUND`, and to clear `asset` when the query
  changes to one that fails. Do not confuse this with `state-02`'s rule — read the
  note above.
- `SIMULATION_FAILED` needs `useSorobanContract.ts:116` and `:120` to throw
  `createStellarError("SIMULATION_FAILED", …)` instead of bare `new Error`.
- Adding codes to a public union is a **minor** change, not a breaking one, but
  consumers with exhaustive switches will notice. `CHANGELOG.md` entry required.
- **Coordinate.** `core-04` and `bug-09` both add codes to this same file.
  Whoever lands second rebases; do not duplicate a constant.

---

### Acceptance criteria

- [ ] All seven codes added to `codes.ts` with entries in `DEFAULT_ERROR_MESSAGES`
- [ ] Default messages are actionable, not restatements of the code name
- [ ] `factory.ts` maps each from the corresponding Horizon `result_codes` value
- [ ] Operation-level codes are checked before transaction-level ones
- [ ] Existing `op_no_trust` / `op_underfunded` classification is unchanged — a
      regression test proves it
- [ ] `useAsset` throws `ASSET_NOT_FOUND`, not `ACCOUNT_NOT_FOUND`
- [ ] `useAsset` clears stale `asset` data when the query changes to a failing one
- [ ] `useSorobanContract` simulation failures throw `SIMULATION_FAILED`
- [ ] `docs/guides/error-handling.md`, `docs/reference/types.md`, and `CHANGELOG.md` updated
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

- The codes: `packages/core/src/errors/codes.ts:8-42`
- The catch-all that swallows everything: `packages/core/src/errors/factory.ts:77-79`
- The `useAsset` bugs: `packages/core/src/hooks/useAsset.ts:69,85-87`
- Related: `core-04` and `bug-09` (same file), `core-06` (reads these structurally),
  `core-07` (`TX_TIMEOUT`), `bug-10` (surfaces these from the write path)
- Horizon result codes: https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/result-codes/operations

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
