---
name: "New hook: useFeeStats"
about: Network fee statistics and surge awareness, so transactions get included
title: "feat(hook): useFeeStats — network fee statistics and surge awareness"
labels: enhancement, hook, good first issue
---

## New hook: `useFeeStats`

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

Horizon's `/fee_stats` endpoint returns the fee distribution of the most recent
ledgers: the minimum accepted fee, the mode, and percentiles from p10 through p99,
for both charged fees and max fees.

This is how you pick a fee that will actually get included. The SDK's `BASE_FEE`
constant is the network _floor_, not a sensible bid — during surge pricing it is
exactly the fee that gets rejected.

Single endpoint, no signing, no wallet interaction, small surface. A genuinely
good first issue that unblocks a much larger one.

---

### Why this matters

`bug-09` needs a data source for its fee strategy. Right now every transaction the
library builds bids the network minimum and fails during any congestion, with an
unhelpful generic error. This hook is the input that fixes it.

It is also useful on its own — a wallet UI showing "network is busy, fees are
elevated" is a small feature that prevents a lot of confused support questions.

---

### Where this lives

- Hook: `packages/core/src/hooks/useFeeStats.ts`
- Test: `packages/core/src/hooks/useFeeStats.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-fee-stats.md`

---

### Suggested API

```ts
export type FeeUrgency = "low" | "normal" | "high"

export interface UseFeeStatsOptions {
  watch?: boolean
  interval?: number
}

export interface UseFeeStatsReturn {
  /** Network minimum, in stroops. */
  baseFee: string
  /** Charged-fee percentiles, in stroops. */
  percentiles: Record<"p10" | "p50" | "p90" | "p95" | "p99", string>
  /** True when recent ledgers show competition above the minimum. */
  isSurging: boolean
  /** A fee to bid, in stroops. Never a number. */
  suggested: (urgency?: FeeUrgency) => string
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}
```

---

### Implementation guidelines

- Use `server.feeStats()` from the SDK, or fetch `/fee_stats` from the resolved
  `horizonUrl`. If `bug-04` has landed, take the URL from `networkConfig`.
- **Every fee value is a stroop string, never a `number`.** Fees are int64. This is
  the same class of trap as `bug-06` — do not round-trip them through
  `parseFloat`. The acceptance criteria are explicit about this because `suggested()`
  feeds directly into transaction building.
- **Derive `isSurging` from the gap between the minimum accepted fee and the mode**,
  and **document the threshold you pick and why**. A hook that reports "surging" on
  an undisclosed heuristic is not useful. Whatever you choose, state it in the
  JSDoc and the docs page.
- **Name the `suggested()` contract carefully — `bug-09` consumes it.** Decide and
  document which percentile each urgency maps to (something like p50 / p90 / p99),
  and that the returned value is a **max bid**, not a charge: Stellar takes only
  what is needed, so bidding high costs nothing when the network is quiet. That
  property is the whole reason `suggested("high")` is safe to use as a default, and
  it needs saying explicitly.
- Support `watch` / `interval` with the same shape as `useBalance`
  (`useBalance.ts:40-45`), and clean up on unmount (`useBalance.ts:93-98`).
- Guard against out-of-order responses and unmount using whatever guard `state-03`
  lands.
- Note in the docs that fee stats reflect **Horizon transactions only** — Soroban
  transactions pay resource fees derived from simulation and are a different
  mechanism entirely (`hook-use-soroban-write`).

---

### Acceptance criteria

- [ ] `useFeeStats` implemented and exported from `packages/core/src/index.ts`
- [ ] `isSurging` derived from the gap between `min_accepted_fee` and the mode, with
      **the threshold documented**
- [ ] `suggested()` returns a stroop **string**, never a number
- [ ] Each `FeeUrgency` value maps to a documented percentile
- [ ] The "a fee is a maximum bid, not a charge" property is documented
- [ ] No `parseFloat` / `Number()` on any fee value
- [ ] `watch` polling works and cleans up on unmount
- [ ] Out-of-order responses and unmount are guarded
- [ ] The Horizon-vs-Soroban fee distinction is noted in the docs
- [ ] Tests cover: a quiet network, a surging network, each urgency level, and a
      failed request
- [ ] Wired into `bug-09`'s fee strategy, or a follow-up noted on that issue
- [ ] `docs/hooks/use-fee-stats.md` follows `docs/example.md`
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

- The `watch`/`interval` shape and cleanup: `packages/core/src/hooks/useBalance.ts:40-45,93-98`
- The consumer: `bug-09` (`useSendPayment.ts:86` and friends)
- The stroop-precision trap: `bug-06`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Horizon `/fee_stats`: https://developers.stellar.org/docs/data/apis/horizon/api-reference/aggregations/fee-stats
- Fees and surge pricing: https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering

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
