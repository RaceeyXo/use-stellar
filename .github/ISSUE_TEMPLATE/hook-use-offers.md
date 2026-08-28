---
name: "New hooks: useOffers and useManageOffer"
about: Read an account's open SDEX offers, and place, update, or cancel them
title: "feat(hook): useOffers and useManageOffer — place and cancel SDEX orders"
labels: enhancement, hook, dex, help wanted
---

## New hooks: `useOffers` and `useManageOffer`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

Reading the book (`useOrderbook`) is half of trading. Placing and cancelling
orders is the other half.

An **offer** is a standing order on the SDEX: "I will sell up to X of asset A at
price P in asset B." It sits on the ledger as a subentry of your account —
consuming reserve — until it is fully consumed or cancelled.

Two things surprise everyone:

1. **Cancelling is an offer with `amount: "0"`** and the existing `offerId`. There
   is no delete operation. Updating is the same call with a non-zero amount.
2. **`manageSellOffer` and `manageBuyOffer` are different operations.** Which one
   you want depends on which side of the pair you are pinning, exactly like the
   strict-send/strict-receive distinction in path payments.

Prices here are rationals, same as `useOrderbook`.

---

### Why this matters

Without these hooks an app can display the market but cannot participate in it.
Market-making, limit orders, and "sell my tokens at this price" are all offers,
and all currently require dropping to the raw SDK.

---

### Where this lives

- Hooks: `packages/core/src/hooks/useOffers.ts`,
  `packages/core/src/hooks/useManageOffer.ts`
- Tests: `packages/core/src/hooks/useOffers.test.tsx`,
  `packages/core/src/hooks/useManageOffer.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hooks and types)
- Docs: `docs/hooks/use-offers.md`, `docs/hooks/use-manage-offer.md`

---

### Suggested API

```ts
// Read
useOffers({ address?, limit? }) → {
  offers: Offer[]
  loading: boolean
  error: StellarError | null
  hasNext: boolean
  fetchNext: () => Promise<void>
  refetch: () => Promise<void>
}

// Write — a signing hook
useManageOffer() → {
  createOffer: (o: {
    selling: Asset
    buying: Asset
    amount: string
    price: string | { n: number; d: number }
    side?: "sell" | "buy"      // which operation to use; default "sell"
  }) => Promise<TransactionResult>
  updateOffer: (offerId: string, o: /* same shape */) => Promise<TransactionResult>
  cancelOffer: (offerId: string) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
```

---

### Implementation guidelines

- `useManageOffer` is a **signing hook** — copy the guard sequence and the
  build → sign → submit flow from `packages/core/src/hooks/useSendPayment.ts`.
- Use `Operation.manageSellOffer` / `Operation.manageBuyOffer`. Expose the choice
  via `side` rather than picking one and hiding the other.
- **`cancelOffer` must be a first-class function, not a documented trick.** Its
  implementation is `amount: "0"` with the existing `offerId`, but the caller
  should never have to know that. Document the mechanism prominently anyway — it
  surprises everyone, and consumers reading a transaction history will see a
  "manage offer" operation where they expected a cancel.
- Accept a price as a decimal **string** or a rational, and convert precisely.
  **Never `parseFloat`** — see `bug-06` and `useOrderbook`'s guidance. If you
  convert a decimal string to a rational, document the precision you use.
- Validate before building: `amount` and `price` must be positive for create and
  update; `offerId` must be present for update and cancel; the two assets must
  differ. Throw `VALIDATION_ERROR`.
- Map `op_low_reserve` to a clear error — offers consume account reserve, and
  "you need more XLM to hold another offer" is a specific, fixable condition.
  Coordinate with `core-05`.
- **`useOffers` pagination:** follow the `usePayments` shape, but land
  **`state-04`, `state-05`, and `state-07` first**, or this hook inherits three
  known pagination bugs by copying the current pattern. If those have not landed,
  say so in your PR and implement the corrected behaviour directly.
- Derive `status` from `res.successful` (`bug-10`).
- **Passive offers** (`createPassiveSellOffer`) are either supported or explicitly
  out of scope — say which in the docs. Do not leave it ambiguous.

---

### Acceptance criteria

- [ ] `useOffers` reads an account's open offers with working pagination
- [ ] `useManageOffer` implements create, update, and cancel
- [ ] Create, update, and cancel are all covered by tests with a mocked adapter
- [ ] `cancelOffer(offerId)` is a first-class function — callers never pass `"0"`
- [ ] Cancel semantics (amount `"0"`) documented prominently
- [ ] Both `manageSellOffer` and `manageBuyOffer` reachable via `side`
- [ ] No float arithmetic on prices anywhere
- [ ] Invalid input (non-positive amount or price, missing `offerId`, identical
      assets) throws `VALIDATION_ERROR` before building
- [ ] `op_low_reserve` surfaces as a distinct, actionable error
- [ ] `status` derived from `res.successful`
- [ ] Pagination does not reproduce `state-05` / `state-07` behaviour
- [ ] Passive offers supported, or explicitly out of scope in the docs
- [ ] Both docs pages follow `docs/example.md`
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

- Signing pattern: `packages/core/src/hooks/useSendPayment.ts`
- Pagination shape (and its bugs): `packages/core/src/hooks/usePayments.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `useOrderbook` (rational prices), `state-04`/`state-05`/`state-07`
  (land first), `bug-10`, `core-05`
- Managing offers: https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#manage-sell-offer

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
