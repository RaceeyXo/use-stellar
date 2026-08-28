---
name: "New hook: usePaymentPaths"
about: Quote and route discovery for swaps — the data usePathPayment needs to build an operation
title: "feat(hook): usePaymentPaths — quote and route discovery for swaps"
labels: enhancement, hook, dex, help wanted
---

## New hook: `usePaymentPaths`

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Before you can make a path payment you need a **route** and a **quote**. Horizon
computes both:

- `/paths/strict-send` — "I will send exactly 100 USDC; what can the recipient get?"
- `/paths/strict-receive` — "The recipient must get exactly 90 EURC; what will it cost?"

Each response is a list of candidate paths. A path is the chain of intermediate
assets the conversion hops through (often empty, meaning a direct market exists),
plus the source and destination amounts for that route.

Without this hook, `usePathPayment` callers have to construct paths by hand — which
means knowing which markets exist, which is not something an app can reasonably
know.

---

### Why this matters

A swap UI needs to show the user what they will receive **before** they sign. That
number comes from here. It is also where the slippage bound `usePathPayment`
requires gets computed from — so this hook is a hard prerequisite for a usable
swap flow, not a nice-to-have alongside it.

---

### Where this lives

- Hook: `packages/core/src/hooks/usePaymentPaths.ts`
- Test: `packages/core/src/hooks/usePaymentPaths.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-payment-paths.md`

---

### Suggested API

```ts
export interface UsePaymentPathsOptions {
  mode: "strictSend" | "strictReceive"
  sourceAsset: Asset
  sourceAmount?: string        // required for strictSend
  destinationAsset: Asset
  destinationAmount?: string   // required for strictReceive
  /** Optional: restrict to what this account can actually receive. */
  destinationAddress?: string
  enabled?: boolean
}

export interface PaymentPath {
  /** Intermediate hops. Empty means a direct market. */
  path: Asset[]
  sourceAmount: string
  destinationAmount: string
  /** destinationAmount / sourceAmount, as a precise decimal string. */
  rate: string
}

export interface UsePaymentPathsReturn {
  paths: PaymentPath[]
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}
```

---

### Implementation guidelines

- Use the SDK's `server.strictSendPaths(...)` / `server.strictReceivePaths(...)`
  builders. The `destinationAddress` variant restricts results to assets that
  account can actually hold, which is usually what a UI wants.
- **Quotes go stale in seconds.** Expose `lastUpdated` and support a refresh
  interval, and document plainly that a quote must be re-fetched immediately
  before submitting. Model the `watch`/`interval` shape on
  `packages/core/src/hooks/useBalance.ts:40-45` so the API is consistent.
- **Compute and expose `rate`** so UIs do not have to. Do the arithmetic on
  strings or `BigInt` — **never** `parseFloat`. `bug-06` documents exactly this
  trap in `formatAmount`; do not reintroduce it here.
- **Memoize on asset primitives, not objects.** `usePaymentHistory.ts:47` makes
  precisely this mistake — an object in a dependency array means an inline
  `sourceAsset={{ code, issuer }}` prop produces a new `paths` array every render
  and loops any consumer effect. Depend on `code` and `issuer` strings.
- **An empty path set is a normal result, not an error.** "No route exists between
  these two assets" is information a UI should render as such. Do not set `error`
  for it.
- Sort paths best-rate-first so `paths[0]` is the one a UI should show by default.
  Document the ordering.
- Validate that the mode's required amount is present, and throw
  `VALIDATION_ERROR` if not — `strictSend` needs `sourceAmount`, `strictReceive`
  needs `destinationAmount`. Consider the same discriminated-union approach
  `usePathPayment` uses so this is a type error too.
- Guard against unmount and out-of-order responses. Copy whichever guard
  `state-03` lands.

---

### Acceptance criteria

- [ ] Both modes supported, with the mode's required amount enforced
- [ ] Paths sorted best-rate-first, and the ordering documented
- [ ] `rate` computed without any float arithmetic
- [ ] `lastUpdated` exposed; staleness documented in the JSDoc and the docs page
- [ ] An empty path set is a normal result — `paths: []`, `error: null`
- [ ] Inline object props do not change the `paths` array identity across renders
- [ ] Unmount and out-of-order responses are guarded
- [ ] `enabled: false` issues no request
- [ ] Tests cover: both modes, no route found, identity stability with inline asset
      props, and a failed request
- [ ] `docs/hooks/use-payment-paths.md` follows `docs/example.md` and shows the
      quote → slippage bound → `usePathPayment` flow
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

- The `watch`/`interval` shape to match: `packages/core/src/hooks/useBalance.ts:40-45`
- The object-dependency mistake to avoid: `packages/core/src/hooks/usePaymentHistory.ts:47`
- The float trap to avoid: `bug-06`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `hook-use-path-payment` (the consumer), `state-03` (race guard)
- Horizon paths: https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-strict-send-payment-paths

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
