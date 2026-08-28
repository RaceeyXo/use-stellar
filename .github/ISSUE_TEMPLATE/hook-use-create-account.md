---
name: "New hook: useCreateAccount"
about: Fund and activate a new Stellar account so payments to it can succeed
title: "feat(hook): useCreateAccount — fund and activate a new Stellar account"
labels: enhancement, hook, help wanted
---

## New hook: `useCreateAccount`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

On Stellar an address does not exist until someone funds it with at least the
**base reserve**. Until then it is just a keypair — not a ledger entry. Sending a
payment to an unfunded address fails with `op_no_destination`.

This is the single most common failure a new Stellar developer hits, and the
correct recovery is a `createAccount` operation: a special payment that brings the
destination into existence and funds it in one step.

`use-stellar` has no way to create an account, so the correct recovery from its
most common error is impossible with this library alone.

The base reserve is **not a constant**. It is a network parameter
(`base_reserve_in_stroops` on the latest ledger) and the minimum balance an account
must hold is `(2 + numberOfSubentries) × baseReserve`. Hardcoding "1 XLM" is a bug
waiting for a protocol upgrade.

---

### Why this matters

Without this hook the story is: try to pay a new user, get an opaque failure,
leave the app, open Stellar Laboratory, create the account by hand, come back.
With it, an app can catch `DESTINATION_NOT_FOUND` and offer "fund this account"
inline.

This is also what makes `useSendPayment`'s most common error recoverable rather
than terminal, which is why `core-05` and this issue reference each other.

---

### Where this lives

- Hook: `packages/core/src/hooks/useCreateAccount.ts`
- Test: `packages/core/src/hooks/useCreateAccount.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-create-account.md`

---

### Suggested API

```ts
export interface CreateAccountOptions {
  destination: string
  /** In XLM. Must meet the network's current base reserve. */
  startingBalance: string
}

export interface UseCreateAccountReturn {
  createAccount: (options: CreateAccountOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
```

---

### Implementation guidelines

- This is a **signing hook**. Model it closely on
  `packages/core/src/hooks/useSendPayment.ts` — same guard sequence at the top
  (`wallet.connected`, `wallet.address`, `wallet.wallet`, `isBrowser()`, network
  mismatch), same build → sign → submit flow, same `reset()`.
- Use `Operation.createAccount({ destination, startingBalance })`.
- **Fetch the base reserve; do not hardcode 1 XLM.** Read
  `base_reserve_in_stroops` from the latest ledger (`server.ledgers().order("desc").limit(1).call()`)
  and reject a `startingBalance` below the minimum with a clear
  `VALIDATION_ERROR` naming the actual required amount.
- **Validate the destination with `StrKey`**, not a regex. `bug-07` adds
  `getAddressType` — use it if it has landed; if not, call
  `StrKey.isValidEd25519PublicKey` directly. A contract (`C…`) address is not a
  valid `createAccount` destination; reject it explicitly.
- **Reject a destination that already exists** with a distinct error code rather
  than letting it fail on-ledger as `op_already_exists`. Check with `loadAccount`
  first — a 404 means "safe to create". Coordinate with `core-05` on whether this
  needs a new code or reuses an existing one.
- Inherit the fee strategy from **`bug-09`** if it has landed; otherwise leave a
  linked TODO rather than hardcoding `BASE_FEE` and adding a fourth call site to
  that issue.
- Derive `status` from `res.successful` — do **not** copy `useSendPayment`'s
  hardcoded `status: "success"` (that is `bug-10`). If `bug-10` has landed, copy the
  corrected version.
- The docs page must show the full recovery flow: `send()` → catch
  `DESTINATION_NOT_FOUND` → `createAccount()` → retry. That worked example is the
  main reason this hook exists.

---

### Acceptance criteria

- [ ] `useCreateAccount` implemented, with `CreateAccountOptions` and
      `UseCreateAccountReturn` in `types/index.ts`
- [ ] Hook and types exported from `packages/core/src/index.ts`
- [ ] Rejects a `startingBalance` below the **fetched** base reserve, with an error
      naming the required amount
- [ ] The base reserve is fetched from the network, never hardcoded
- [ ] Rejects a destination that already exists, with a distinct code
- [ ] Rejects a `C…` contract address as a destination
- [ ] All wallet and network guards match `useSendPayment`
- [ ] `status` is derived from `res.successful`, not hardcoded
- [ ] Errors normalized through `toStellarError`; `reset()` clears state
- [ ] Tests cover: success, wallet-not-connected, below-reserve, existing
      destination, invalid address, and a submit failure — mock the wallet adapter
      and Horizon, never hit the network
- [ ] `docs/hooks/use-create-account.md` shows the
      `DESTINATION_NOT_FOUND` → create-account recovery flow
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

- Pattern to copy: `packages/core/src/hooks/useSendPayment.ts`
- Error codes: `packages/core/src/errors/codes.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `core-05` (`DESTINATION_NOT_FOUND`), `bug-07` (address validation),
  `bug-09` (fees), `bug-10` (status), `hook-use-friendbot` (the testnet shortcut)
- Account creation: https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts
- Minimum balance: https://developers.stellar.org/docs/learn/fundamentals/lumens#minimum-balance

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
