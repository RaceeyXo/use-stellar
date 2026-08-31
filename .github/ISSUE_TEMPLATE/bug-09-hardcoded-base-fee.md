---
name: "Bug 09: Hardcoded BASE_FEE fails during network surge"
about: Replace the constant 100-stroop fee with a real, configurable fee strategy
title: "fix(hooks): replace hardcoded BASE_FEE with a real fee strategy"
labels: bug, enhancement
---

## Replace hardcoded `BASE_FEE` with a real fee strategy

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

Stellar prices transactions by auction. Each ledger has limited capacity; when
more transactions are submitted than fit, the network takes the highest bidders
and rejects the rest with `tx_insufficient_fee`. `BASE_FEE` from the SDK is the
**network minimum** (100 stroops per operation) — the floor of the auction, not a
sensible bid.

The SDK gives you `server.fetchBaseFee()` for the current floor and Horizon
exposes `/fee_stats` for the full distribution of what recent ledgers actually
accepted.

Soroban is different again: contract transactions pay a **resource fee** derived
from simulation, not a flat per-operation fee.

---

### The defect

`fee: BASE_FEE` appears in all three transaction-building hooks:

- `packages/core/src/hooks/useSendPayment.ts:86`
- `packages/core/src/hooks/useAddTrustline.ts` (the `TransactionBuilder` call)
- `packages/core/src/hooks/useSorobanContract.ts:106`

There is no `server.fetchBaseFee()` anywhere in the library, no way for a caller
to pass a fee, no multiplier option, and no fee-bump path.

---

### Why this matters

During any period of congestion — which on mainnet means a normal weekday — every
transaction the library builds is rejected with `tx_insufficient_fee`. That result
code is not mapped to anything specific (`errors/factory.ts:77-79` collapses it
into `TRANSACTION_FAILED`), so the user sees a generic "The transaction failed on
the network" with no explanation and no path forward. They retry, it fails again,
and nothing in the error tells them or the developer that the fee is the problem.

---

### Where this lives

- Hooks: `packages/core/src/hooks/useSendPayment.ts`,
  `packages/core/src/hooks/useAddTrustline.ts`,
  `packages/core/src/hooks/useSorobanContract.ts`
- Types: `packages/core/src/types/index.ts` (`SendPaymentOptions`, `AddTrustlineOptions`)
- Errors: `packages/core/src/errors/codes.ts`, `packages/core/src/errors/factory.ts`
- Tests: the corresponding `*.test.tsx` files

---

### Suggested API

```ts
export interface FeeOptions {
  /** Explicit fee in stroops. Wins over everything else. */
  fee?: string
  /** Multiply the fetched network base fee. Default documented below. */
  feeMultiplier?: number
}

// Both write hooks take these alongside their existing options:
send({ to, asset, amount, fee: "10000" })
send({ to, asset, amount, feeMultiplier: 10 })
```

---

### Implementation guidelines

- **Precedence:** explicit `fee` → `feeMultiplier × fetchedBaseFee` → default
  multiplier × fetched base fee. Never fall back to the `BASE_FEE` constant
  silently; if `fetchBaseFee()` fails, surface that rather than bidding the floor.
- Pick a surge-tolerant default multiplier and **document the number and the
  reasoning** in the JSDoc and in `docs/hooks/use-send-payment.md`. A fee is a
  maximum bid, not a charge — the network takes only what it needs — so a generous
  default costs the user nothing in the common case. Say that in the docs, because
  it is the non-obvious part.
- Wire the default to **`hook-use-fee-stats`** once that lands, so the default is
  informed by `/fee_stats` percentiles rather than the bare minimum. If `useFeeStats`
  is not merged yet, use `server.fetchBaseFee()` and leave a linked TODO.
- **Soroban is a separate path.** `useSorobanContract.ts:106` should take its fee
  from the simulation result, not from a multiplier. Coordinate with
  `hook-use-soroban-write` — if that issue is in flight, scope this one to the two
  Horizon hooks and note the split in your PR.
- Add a `FEE_TOO_LOW` error code to `errors/codes.ts` with a message in
  `DEFAULT_ERROR_MESSAGES`, and map `tx_insufficient_fee` to it in
  `errors/factory.ts` **before** the generic `TRANSACTION_FAILED` branch at line 77.
  Coordinate with `core-05`, which adds this same code among others — whoever
  lands second rebases rather than duplicating.
- Fee **bumping** (resubmitting an existing signed envelope at a higher fee) is
  out of scope. Note it as a follow-up.

---

### Acceptance criteria

- [ ] `send({ …, fee: "10000" })` builds a transaction with exactly that fee
- [ ] `send({ …, feeMultiplier: 10 })` uses 10× the **fetched** base fee
- [ ] The default fee is derived from `fetchBaseFee()` (or `useFeeStats`), never
      from the `BASE_FEE` constant
- [ ] A failing `fetchBaseFee()` surfaces an error rather than silently bidding the minimum
- [ ] `tx_insufficient_fee` surfaces as `FEE_TOO_LOW`, not `TRANSACTION_FAILED`
- [ ] All three call sites updated (or the Soroban split documented in the PR)
- [ ] The default multiplier and the "fee is a maximum bid" behaviour are documented
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

- Call sites: `useSendPayment.ts:86`, `useAddTrustline.ts`, `useSorobanContract.ts:106`
- Where `tx_insufficient_fee` currently disappears: `packages/core/src/errors/factory.ts:77-79`
- Related: `hook-use-fee-stats` (the data source), `core-05` (the error code),
  `hook-use-soroban-write` (the Soroban resource-fee path)
- Stellar fees and surge pricing: https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering
- Horizon `/fee_stats`: https://developers.stellar.org/docs/data/apis/horizon/api-reference/aggregations/fee-stats

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
