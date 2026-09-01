---
name: "New hook: usePaymentHistory"
about: A payments-only history hook with direction/asset filtering, built on the payment stream
title: "feat(hook): usePaymentHistory — filtered, payments-only account history"
labels: enhancement, hook
---

## New hook: `usePaymentHistory`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

`useTransactionHistory` returns every transaction (offers, trustlines, merges,
payments — everything). But a huge share of apps only care about **payments**:
"show me the money in and out of this account." `usePaymentHistory` is the
focused, ergonomic answer to that — payments only, with built-in filtering by
direction (incoming/outgoing) and by asset, so the consumer does not have to
post-filter a raw list themselves.

> **Note on overlap with `usePayments`.** The repo already has `usePayments`
> (`packages/core/src/hooks/usePayments.ts`), which fetches and paginates
> payments. `usePaymentHistory` is meant to be the _cleaner, filter-first_ layer
> on top of that same data: same normalized records, but with `direction` and
> `asset` filters as first-class options and a simpler surface. Before writing
> code, **confirm with the maintainer in the issue comments** whether this should
> (a) wrap/extend `usePayments`, or (b) supersede it. Do not silently duplicate
> logic — reuse `normalizePayment` and the pagination pattern from `usePayments`.

This is a **read-only** hook.

---

### Why this matters

Most payment UIs — wallets, tip jars, invoicing tools — want "incoming USDC" or
"everything I sent" without hand-rolling filters over a mixed operation list.
Giving them a payments-only hook with filters baked in removes boilerplate every
consumer would otherwise repeat, and keeps the filtering correct and consistent.

---

### Where this lives

- Hook: `packages/core/src/hooks/usePaymentHistory.ts`
- Test: `packages/core/src/hooks/usePaymentHistory.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)

Reuse `NormalizedPayment` and the `normalizePayment` helper from `usePayments`.
Match its `fetchNext` / `fetchPrev` / `hasNext` / `hasPrev` pagination exactly.

---

### Suggested API

```ts
export interface UsePaymentHistoryOptions {
  address?: string | null // defaults to connected wallet
  limit?: number // default 10
  order?: "asc" | "desc" // default "desc"
  cursor?: string
  direction?: "incoming" | "outgoing" | "all" // default "all"
  asset?: Asset | "all" // filter to XLM, an issued asset, or all
}

export interface UsePaymentHistoryReturn {
  payments: NormalizedPayment[] // already filtered
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}
```

---

### Implementation guidelines

- Build on the exact fetch + cursor-pagination flow in `usePayments` — do not
  reinvent it. If you extract shared logic, keep `usePayments` working and update
  it in the same PR.
- Apply `direction` and `asset` filters to the normalized records **after**
  fetching. Filtering is by value: `direction === payment.direction`; for `asset`,
  compare `"XLM"` to `"XLM"` and match issued assets by `code` **and** `issuer`.
- `direction: "all"` and `asset: "all"` mean no filtering on that axis.
- Because filtering happens client-side per page, document clearly that
  `limit` applies to the fetched page **before** filtering (a page of 10 may show
  fewer than 10 after filtering). Note this in the hook's doc comment and the docs.
- Resolve address as `address ?? wallet.address`; empty address → `payments: []`,
  no network call.
- Normalize errors with `toStellarError`.

---

### Acceptance criteria

- [ ] `usePaymentHistory` implemented in
      `packages/core/src/hooks/usePaymentHistory.ts`
- [ ] Overlap with `usePayments` resolved with the maintainer and the chosen
      approach (wrap vs supersede) noted in the PR description
- [ ] `direction` filter works for `incoming`, `outgoing`, and `all`
- [ ] `asset` filter works for `"XLM"`, an issued `{ code, issuer }`, and `"all"`
- [ ] Pagination matches `usePayments` (`fetchNext/fetchPrev/hasNext/hasPrev`)
- [ ] The "limit applies before filtering" behaviour is documented
- [ ] Shared `normalizePayment` logic is reused, not duplicated
- [ ] Errors normalized through `toStellarError`
- [ ] Tests in `usePaymentHistory.test.tsx` cover: unfiltered, incoming-only,
      outgoing-only, asset filter (XLM and issued), empty address, and a Horizon
      error — mock Horizon
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] PR description includes `Closes #[issue number]`

---

### Reference

- Pattern to copy / reuse: `packages/core/src/hooks/usePayments.ts`
- Asset helpers: `isNativeAsset`, `isIssuedAsset` in
  `packages/core/src/utils/index.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- npm API reference: https://www.npmjs.com/package/use-stellar

---

### Important rules — read before you start

- **Get assigned first.** Do not open a PR before you are assigned. Unassigned PRs
  are closed without review.
- **Make sure CI/CD passes.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` locally and confirm green before pushing.
- **Pull before you push.** `git pull --rebase origin main` right before pushing.
- **Do not touch files outside your task.** Only the files under "Where this
  lives" (plus `usePayments.ts` **only** if the agreed approach requires it). Do
  not reformat, rename, or delete unrelated files.
- **Follow existing conventions** — match `usePayments` and the other read hooks.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
