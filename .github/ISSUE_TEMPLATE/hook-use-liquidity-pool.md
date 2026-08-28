---
name: "New hooks: useLiquidityPool and useLiquidityPoolActions"
about: Pool info, deposit, and withdraw — plus fixing the Asset union that hides LP balances
title: "feat(hook): useLiquidityPool — pool info, deposit, and withdraw"
labels: enhancement, hook, dex, help wanted
---

## New hooks: `useLiquidityPool` and `useLiquidityPoolActions`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

Stellar has **native AMM liquidity pools** — constant-product pools built into the
protocol, not smart contracts. You deposit two assets, receive pool shares, and
earn a cut of the trades routed through the pool. Path payments
(`hook-use-path-payment`) route through them automatically.

There is a type-level bug blocking this today.

`packages/core/src/types/index.ts:89` — `Balance` correctly allows an LP position:

```ts
asset: "liquidity_pool_shares"
```

`packages/core/src/types/index.ts:104` — but `Asset` does not:

```ts
export type Asset = NativeAsset | IssuedAsset
```

So `useBalance`'s selector at `packages/core/src/hooks/useBalance.ts:101-107` can
**never** match an LP position — it compares against `"XLM"` or an
`{ code, issuer }` object, and there is no third branch. A user's pool shares are
invisible to the library.

The mismatch also forces a cast in `parseHorizonBalance` —
`packages/core/src/utils/index.ts:59-67`:

```ts
if (raw.asset_type === "liquidity_pool_shares") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lp = raw as any
  return { /* … */ } as Balance
}
```

Two casts and a lint suppression, all because of the missing union member.

---

### Why this matters

An LP position is real money the user owns and the library cannot see. Any
portfolio view built on `useBalance` under-reports the user's holdings with no
indication anything is missing.

---

### Where this lives

- Hooks: `packages/core/src/hooks/useLiquidityPool.ts`,
  `packages/core/src/hooks/useLiquidityPoolActions.ts`
- Tests: the corresponding `*.test.tsx` files
- Types: `packages/core/src/types/index.ts` (`Asset` union)
- Utils: `packages/core/src/utils/index.ts` (`parseHorizonBalance`, type guards)
- Hook: `packages/core/src/hooks/useBalance.ts` (selector)
- Export: `packages/core/src/index.ts`
- Docs: `docs/hooks/use-liquidity-pool.md`

---

### Suggested API

```ts
useLiquidityPool(poolId) → {
  pool: LiquidityPool | null   // reserves, total shares, fee, trustline count
  loading: boolean
  error: StellarError | null
  refetch: () => Promise<void>
}

useLiquidityPoolActions() → {
  deposit: (o: {
    poolId: string
    maxAmountA: string; maxAmountB: string
    minPrice: string | { n: number; d: number }
    maxPrice: string | { n: number; d: number }
  }) => Promise<TransactionResult>
  withdraw: (o: {
    poolId: string
    amount: string              // pool shares to burn
    minAmountA: string; minAmountB: string
  }) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
```

---

### Implementation guidelines

- **Fix the `Asset` union as part of this issue.** Add `"liquidity_pool_shares"`,
  then remove the `as any` and `as Balance` casts at `utils/index.ts:59-67` and the
  lint suppression above them. Add a third branch to `useBalance`'s selector at
  `useBalance.ts:101-107` so an LP position can be selected. This is a public type
  change — `CHANGELOG.md` and `docs/reference/types.md` both need updating.
- **Export the type guards.** `isNativeAsset` and `isIssuedAsset`
  (`utils/index.ts:21-27`) are currently internal — they are not in the export list
  at `index.ts:62-69`. Without them a consumer cannot narrow the `Balance` union at
  all, which becomes acute once it has three members. Export both, plus a new
  `isLiquidityPoolShares` guard. Note that `bug-05` tightens `isIssuedAsset` —
  coordinate rather than conflicting.
- `useLiquidityPoolActions` is a **signing hook**: copy the guards and the
  build → sign → submit flow from `useSendPayment.ts`.
- Use `Operation.liquidityPoolDeposit` / `Operation.liquidityPoolWithdraw`.
- **The price bounds on deposit are slippage protection**, exactly like
  `usePathPayment`'s `destMin`. `minPrice` / `maxPrice` must be **required**, and a
  call omitting them must be rejected rather than defaulting to something
  permissive. Depositing into a pool whose ratio moved without bounds means
  depositing at a rate you did not agree to.
- Same for withdraw: `minAmountA` / `minAmountB` are required.
- No float arithmetic on prices or reserves — same rule as `useOrderbook`.
- Depositing requires a **trustline to the pool share asset** first. Document that
  prerequisite and point at `useAddTrustline`; it is the first thing every consumer
  will hit.
- Derive `status` from `res.successful` (`bug-10`).

---

### Acceptance criteria

- [ ] `Asset` union includes `"liquidity_pool_shares"`
- [ ] The `as any` cast and lint suppression at `utils/index.ts:59-67` are gone
- [ ] `useBalance` can select and return an LP share balance
- [ ] `isNativeAsset`, `isIssuedAsset`, and a new `isLiquidityPoolShares` guard are
      exported from `packages/core/src/index.ts`
- [ ] `useLiquidityPool` returns reserves, total shares, and fee for a pool id
- [ ] Deposit and withdraw both implemented and covered by tests with a mocked adapter
- [ ] Price bounds and minimum amounts are **required** — omitting them is rejected,
      never defaulted
- [ ] No float arithmetic on prices or reserves
- [ ] The pool-share trustline prerequisite is documented
- [ ] `status` derived from `res.successful`
- [ ] `CHANGELOG.md` and `docs/reference/types.md` reflect the `Asset` union change
- [ ] `docs/hooks/use-liquidity-pool.md` follows `docs/example.md`
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

- The union mismatch: `packages/core/src/types/index.ts:89,104`
- The casts it forces: `packages/core/src/utils/index.ts:59-67`
- The selector that can never match: `packages/core/src/hooks/useBalance.ts:101-107`
- The unexported guards: `packages/core/src/utils/index.ts:21-27`, `packages/core/src/index.ts:62-69`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `bug-05` (tightens `isIssuedAsset`), `bug-10`, `hook-use-path-payment`
- Liquidity pools: https://developers.stellar.org/docs/learn/encyclopedia/sdex/liquidity-on-stellar-sdex-liquidity-pools

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
