---
name: "New hook: useSorobanWrite"
about: Invoke, sign, and submit a Soroban contract call — contract writes are impossible today
title: "feat(hook): useSorobanWrite — invoke, sign, and submit a Soroban contract call"
labels: enhancement, hook, soroban, help wanted
---

## New hook: `useSorobanWrite`

**Complexity:** Very High (300 points)
**Estimated time:** ~1 week

---

### Context

`useSorobanContract` only calls `simulateTransaction` (`useSorobanContract.ts:113`).
It is **read-only**. Contract writes are impossible with this library today —
no Soroban token transfers, no swaps, no minting, no DeFi.

For a package that lists `soroban` as its second npm keyword
(`packages/core/package.json:74-76`), this is the headline gap.

A Soroban write is a five-step flow, and it is not optional to do all five:

1. **Build** the invocation transaction
2. **Simulate** it — this returns the resource footprint, the resource fee, and
   any auth entries
3. **Assemble** — `assembleTransaction(tx, simResult)` applies the footprint and
   fee to produce the transaction that will actually be submitted
4. **Sign** via the wallet adapter
5. **Send**, then **poll `getTransaction` until it leaves `NOT_FOUND`/`PENDING`**

Step 5 is where most implementations get it wrong. `sendTransaction` returns as
soon as the RPC accepts the envelope — **not** when the transaction executes. The
result is only available by polling.

---

### Why this matters

This is the difference between the library supporting Soroban and merely
mentioning it. Every Soroban application is built on contract writes.

---

### Where this lives

- Hook: `packages/core/src/hooks/useSorobanWrite.ts`
- Test: `packages/core/src/hooks/useSorobanWrite.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Errors: `packages/core/src/errors/codes.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-soroban-write.md`

---

### Suggested API

```ts
export interface SorobanInvokeOptions {
  contractId: string
  method: string
  args?: xdr.ScVal[]
  /** Resource fee comes from simulation; this is the inclusion fee. */
  fee?: string
  /** Poll timeout in ms before giving up and surfacing TX_TIMEOUT. */
  timeout?: number
}

export function useSorobanWrite<T = unknown>(): {
  invoke: (options: SorobanInvokeOptions) => Promise<{ hash: string; result: T }>
  loading: boolean
  error: StellarError | null
  result: { hash: string; result: T } | null
  reset: () => void
}
```

---

### Implementation guidelines

- **Implement the full flow.** Do not skip `assembleTransaction` — submitting the
  pre-simulation transaction fails with a resource error, and the failure message
  does not say why.
- **Polling is mandatory and needs a timeout.** Poll `getTransaction(hash)` until
  the status leaves `NOT_FOUND` / `PENDING`. On timeout, surface `TX_TIMEOUT` with
  the hash attached rather than hanging forever or reporting a false failure —
  the transaction may still land. Same reasoning as `core-07`; read that issue.
- **Handle `restorePreamble`.** When simulation reports that contract state has
  been archived, the caller must submit a `RestoreFootprint` transaction before
  the invocation can succeed. Surface this as a **distinct, actionable error**
  naming what needs restoring — or implement automatic restore behind an explicit
  opt-in flag. A generic failure here is useless; the user cannot guess.
- **Soroban fees are resource fees, not the flat `BASE_FEE`.** Take the resource
  fee from the simulation result. The inclusion fee is separate and is what the
  `fee` option controls. Coordinate with `bug-09` — do not add a fourth hardcoded
  `BASE_FEE` call site.
- Auth entries: a simulation may return auth requirements that need signing. Scope
  this issue to the source-account-auth case (the common one) and file
  multi-party `signAuthEntry` as a follow-up — but say so explicitly in the docs
  rather than letting it fail mysteriously.
- Decode the return value with `scValToNative`, falling back to raw XDR when
  decoding fails — `useSorobanContract.ts:129-133` already has this pattern; reuse
  it.
- `SIMULATION_FAILED` and `TX_TIMEOUT` come from **`core-05`**. Land that first.
- Copy the wallet guards from `useSendPayment.ts` — connected, address, adapter,
  `isBrowser()`, network mismatch.
- **Take `xdr.ScVal[]` as the primary argument type.** Do not reuse
  `useSorobanContract`'s `toScVal` inference, which guesses wrong in several cases
  (see `hook-use-soroban-contract-typed`). Requiring explicit `ScVal`s is correct
  for a write path where a type mismatch costs a failed transaction.

---

### Acceptance criteria

- [ ] Full simulate → assemble → sign → send → poll flow implemented
- [ ] `assembleTransaction` is applied — a test asserts the submitted transaction
      carries the simulated footprint
- [ ] Polling has a timeout and surfaces `TX_TIMEOUT` with the hash rather than hanging
- [ ] `restorePreamble` produces a distinct, documented error path
- [ ] Resource fee comes from simulation, never a hardcoded constant
- [ ] Return value decoded with `scValToNative`, with a raw-XDR fallback
- [ ] Generic `<T>` flows through to `result` with no cast at the call site
- [ ] Auth-entry scope stated explicitly in the docs
- [ ] All wallet and network guards match `useSendPayment`
- [ ] Tests cover: success, simulation failure, archived state (`restorePreamble`),
      poll timeout, and wallet-not-connected
- [ ] `docs/hooks/use-soroban-write.md` follows `docs/example.md` and documents the
      full five-step flow
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

- The read-only hook: `packages/core/src/hooks/useSorobanContract.ts`
- The decode fallback to reuse: `packages/core/src/hooks/useSorobanContract.ts:129-133`
- Signing pattern: `packages/core/src/hooks/useSendPayment.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `core-05` (`SIMULATION_FAILED`, `TX_TIMEOUT`), `core-07` (timeout
  reasoning), `bug-09` (fees), `hook-use-soroban-contract-typed` (why explicit ScVals)
- Soroban transaction lifecycle: https://developers.stellar.org/docs/build/guides/transactions/submit-transaction-wait-async
- State archival and restore: https://developers.stellar.org/docs/learn/encyclopedia/storage/state-archival

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
