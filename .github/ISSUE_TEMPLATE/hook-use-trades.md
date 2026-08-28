---
name: "New hook: useTrades"
about: Executed trade history for an account, an asset pair, or a liquidity pool
title: "feat(hook): useTrades — executed trade history for an account or asset pair"
labels: enhancement, hook, dex, help wanted
---

## New hook: `useTrades`

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Horizon's `/trades` endpoint returns **executed** trades — the fills, as opposed to
the standing offers `useOffers` reads or the open book `useOrderbook` reads. It is
filterable by account, by asset pair, or by liquidity pool.

Trades are what you need for fill history ("did my order execute?"), price charts
(historical prices come from executed trades, not from the book), and portfolio
P&L.

One wrinkle: Horizon reports each trade with a **base** and a **counter** asset,
and which of your two assets ends up as "base" depends on Stellar's canonical
asset ordering, not on how you asked. So the same logical pair can come back
oriented either way, and a consumer comparing prices across pages has to flip half
of them.

---

### Why this matters

Without this hook, an app that places an offer through `useManageOffer` has no way
to find out whether it filled — only that it is no longer in the open-offers list,
which could equally mean it was cancelled.

---

### Where this lives

- Hook: `packages/core/src/hooks/useTrades.ts`
- Test: `packages/core/src/hooks/useTrades.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-trades.md`

---

### Suggested API

```ts
export interface NormalizedTrade {
  id: string
  ledgerCloseTime: string
  baseAsset: Asset
  baseAmount: string
  counterAsset: Asset
  counterAmount: string
  /** Exact price as a rational. */
  priceR: { n: number; d: number }
  /** Precise decimal string. Display only. */
  price: string
  /** Which side the queried account was on, when filtering by account. */
  side?: "buy" | "sell"
  baseIsSeller: boolean
}

useTrades({ address?, baseAsset?, counterAsset?, limit?, order? }) → {
  trades: NormalizedTrade[]
  loading: boolean
  error: StellarError | null
  hasNext: boolean
  hasPrev: boolean
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  refetch: () => Promise<void>
}
```

---

### Implementation guidelines

- **Normalize base/counter into a stable orientation.** Decide the rule — most
  naturally, orient to the `baseAsset` the caller asked for — and apply it
  consistently, inverting the price rational when you flip. Document the rule. Not
  doing this pushes the problem onto every consumer, and most will get it wrong.
- Support all three filter modes: by account, by asset pair, and by both together.
  Liquidity-pool trades are also available — either support the filter or say it is
  out of scope.
- **Pagination: use the corrected cursor pattern, not the current one.** Land
  `state-04`, `state-05`, and `state-07` first if you can. If you cannot, implement
  the corrected behaviour here directly and note it — copying `usePayments` as it
  stands imports three known bugs (unguarded races, cursors that survive a query
  change, and a `hasNext` heuristic that strands users on an empty page).
- **Price is a rational.** Expose `priceR` and a precise decimal string; no float
  arithmetic. Same rule as `useOrderbook`.
- When filtering by account, derive `side` from whether the account was the base
  seller — this is the field a fill-history UI actually renders, and computing it
  correctly is fiddly enough to be worth doing once here.
- Memoize on asset primitives, not asset objects.
- Guard against out-of-order responses and unmount.

---

### Acceptance criteria

- [ ] Filterable by account, by asset pair, and by both
- [ ] Base/counter normalized to a documented, stable orientation, with the price
      rational inverted when the pair is flipped
- [ ] Trade price exposed as an exact rational **and** a precision-safe string
- [ ] No float arithmetic anywhere in the hook
- [ ] `side` is correct for account-filtered queries — covered by a test with the
      account on each side
- [ ] Pagination uses the corrected cursor pattern, not the current buggy one
- [ ] Out-of-order responses and unmount are guarded
- [ ] Liquidity-pool trades supported or explicitly out of scope in the docs
- [ ] Tests cover: each filter mode, a flipped pair, both `side` values, and pagination
- [ ] `docs/hooks/use-trades.md` follows `docs/example.md` and explains base/counter
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

- Pagination shape (and its bugs): `packages/core/src/hooks/usePayments.ts:46-124`
- Normalization pattern: `packages/core/src/hooks/usePayments.ts:143-211`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `state-04`, `state-05`, `state-07` (land first), `useOrderbook`,
  `hook-use-offers`
- Horizon trades: https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-trades

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
