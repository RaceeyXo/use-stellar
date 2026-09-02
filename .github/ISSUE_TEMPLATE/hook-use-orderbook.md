---
name: "New hook: useOrderbook"
about: Live SDEX order book for an asset pair — bids, asks, spread, mid price
title: "feat(hook): useOrderbook — live SDEX order book for an asset pair"
labels: enhancement, hook, dex, help wanted
---

## New hook: `useOrderbook`

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Stellar has a **native on-chain order book** — the SDEX. It is part of the
protocol, not a smart contract, and Horizon exposes it at `/order_book` for any
asset pair, with both polling and SSE streaming support.

Any trading UI, swap preview, or price display needs bids, asks, and the spread
between them.

**Prices come back as rationals**, not decimals:

```json
{ "price_r": { "n": 7, "d": 3 }, "price": "2.3333333", "amount": "100.0000000" }
```

The `{ n, d }` pair is the exact price the offer was placed at. The `price` string
is Horizon's own decimal rendering of it and is already rounded. Any arithmetic —
spread, mid price, depth totals — must be done on the rationals.

---

### Why this matters

Without the order book, a swap UI can show a quote (`usePaymentPaths`) but cannot
show _why_ — no depth, no spread, no sense of whether the market is thin. For
anything trading-adjacent that is the core display.

---

### Where this lives

- Hook: `packages/core/src/hooks/useOrderbook.ts`
- Test: `packages/core/src/hooks/useOrderbook.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-orderbook.md`

---

### Suggested API

```ts
export interface OrderbookEntry {
  /** Exact price as a rational — use this for arithmetic. */
  priceR: { n: number; d: number }
  /** Precise decimal string derived from priceR. Display only. */
  price: string
  amount: string
}

export interface UseOrderbookOptions {
  selling: Asset
  buying: Asset
  limit?: number
  watch?: boolean
  interval?: number
  enabled?: boolean
}

export interface UseOrderbookReturn {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  /** null when either side is empty. */
  spread: string | null
  midPrice: string | null
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}
```

---

### Implementation guidelines

- **No float arithmetic anywhere in this hook.** Spread and mid price are computed
  from the rationals: with bid `n₁/d₁` and ask `n₂/d₂`, the spread is
  `(n₂·d₁ − n₁·d₂) / (d₁·d₂)`. Use `BigInt` for the cross-multiplications and
  render the result as a decimal string. `bug-06` is the cautionary tale — the same
  mistake in a price display is worse than in a balance display.
- **Expose both forms.** `priceR` for anyone doing their own arithmetic, `price` as
  a precise decimal string for display. Do not expose a `number`.
- **`spread` and `midPrice` must be `null` when either side is empty.** A one-sided
  book is normal for a thin market; returning `0` or `NaN` for it is a bug.
- Support `watch` polling with the same `{ watch, interval }` shape as
  `useBalance` (`useBalance.ts:40-45`) so the API is consistent across the library.
  SSE streaming is the better mechanism — if you implement it, share the connection
  machinery with `hook-use-stream-payments` rather than writing a second
  implementation. Polling alone is acceptable for this issue; say which you did.
- Clean up properly on unmount: clear the interval, and close the stream if you
  built one. `useBalance.ts:93-98` shows the shape.
- Consider exposing depth-aggregated totals (cumulative amount at each price level)
  for chart consumers. Optional, but say in the docs whether you did.
- Memoize on asset primitives (`code` / `issuer`), not the asset objects — same
  trap as `usePaymentHistory.ts:47`.
- Guard against out-of-order responses and unmount using whatever guard `state-03`
  lands.

---

### Acceptance criteria

- [ ] Prices exposed as exact rationals **and** precision-safe decimal strings
- [ ] **No float arithmetic anywhere in the hook** — no `parseFloat`, no `Number()`,
      no `/` on prices
- [ ] `spread` and `midPrice` are `null` when either side is empty
- [ ] A test asserts the spread of a known rational pair is exact
- [ ] `watch` mode polls and cleans up on unmount
- [ ] `enabled: false` issues no request and opens no connection
- [ ] Inline asset object props do not change result identity across renders
- [ ] Out-of-order responses and unmount are guarded
- [ ] Tests cover: both sides populated, an empty side, an entirely empty book,
      `watch` cleanup, and rational arithmetic exactness
- [ ] `docs/hooks/use-orderbook.md` follows `docs/example.md` and explains the
      rational price format
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
- The float trap: `bug-06`
- The object-dependency trap: `packages/core/src/hooks/usePaymentHistory.ts:47`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `hook-use-offers`, `hook-use-trades`, `hook-use-stream-payments`
  (share the SSE machinery)
- Horizon order book: https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-order-book

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
