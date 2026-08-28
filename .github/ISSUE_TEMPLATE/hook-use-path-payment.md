---
name: "New hook: usePathPayment"
about: Strict-send and strict-receive swaps — Stellar's built-in atomic asset conversion
title: "feat(hook): usePathPayment — strict-send and strict-receive swaps"
labels: enhancement, hook, dex, help wanted
---

## New hook: `usePathPayment`

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

Path payments are Stellar's built-in swap. You send USDC, the recipient receives
EURC, and the network routes through the SDEX order book and liquidity pools
**atomically** — either the whole conversion happens at an acceptable rate or
nothing does. No smart contract, no separate DEX integration, one operation.

There are two modes, and the difference is which side is pinned:

| Mode | You pin | You bound | Operation |
|---|---|---|---|
| **strict send** | `sendAmount` — exactly what leaves your account | `destMin` — the least the recipient will accept | `pathPaymentStrictSend` |
| **strict receive** | `destAmount` — exactly what arrives | `sendMax` — the most you will spend | `pathPaymentStrictReceive` |

The bound is the **slippage protection**. Rates move between quoting and
execution; the bound is what stops the transaction executing at a rate you never
agreed to.

This is arguably Stellar's flagship feature and the library cannot do it at all.

---

### Why this matters

Every swap UI, every "pay in any asset" checkout, and every cross-currency
remittance flow on Stellar is a path payment. Without this hook, the library
covers same-asset payments only — which is the least interesting thing Stellar
does.

---

### Where this lives

- Hook: `packages/core/src/hooks/usePathPayment.ts`
- Test: `packages/core/src/hooks/usePathPayment.test.tsx`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-path-payment.md`

---

### Suggested API

```ts
export type PathPaymentOptions =
  | {
      mode: "strictSend"
      destination: string
      sendAsset: Asset
      sendAmount: string
      destAsset: Asset
      destMin: string          // required — not optional
      path?: Asset[]
    }
  | {
      mode: "strictReceive"
      destination: string
      sendAsset: Asset
      sendMax: string          // required — not optional
      destAsset: Asset
      destAmount: string
      path?: Asset[]
    }

export interface UsePathPaymentReturn {
  pathPayment: (options: PathPaymentOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}
```

---

### Implementation guidelines

- **Slippage is the safety-critical part.** `destMin` / `sendMax` must be
  **required**, not optional, and the hook must reject a call that omits them
  rather than defaulting to something permissive. A default of `"0"` for `destMin`
  authorises the network to give the recipient nothing. Make the discriminated
  union above do the work — the `mode` field should make the wrong shape a
  **compile error**, with a runtime `VALIDATION_ERROR` as the backstop for callers
  coming from JavaScript.
- Use `Operation.pathPaymentStrictSend` / `Operation.pathPaymentStrictReceive`.
- Model the guards and the build → sign → submit flow on
  `packages/core/src/hooks/useSendPayment.ts` — same wallet checks, same
  `toStellarError` handling, same `reset()`.
- **Reuse the asset conversion, and do not reintroduce `bug-05`.** `useSendPayment`'s
  `toStellarAsset` silently falls back to XLM for unrecognised assets. Land
  `bug-05` first, or write the strict version here and note the duplication.
  Sending the wrong asset is bad; sending the wrong asset *in a swap* is worse.
- Take `path` from **`usePaymentPaths`**. An empty `path` array is valid and means
  "direct conversion" — do not treat it as missing.
- **Quotes go stale in seconds.** The docs must say plainly: fetch the path,
  compute the bound with an explicit slippage tolerance, and submit immediately. A
  worked example with a stated tolerance (e.g. 1%) and the arithmetic shown is
  required, not optional — this is where consumers lose money if the docs hand-wave.
- Map `op_under_dest_min` / `op_over_source_max` to a specific error so a UI can
  say "the rate moved" rather than "transaction failed". Coordinate with `core-05`.
- Derive `status` from `res.successful` (see `bug-10`).

---

### Acceptance criteria

- [ ] Both modes implemented; `mode` discriminates which fields are required **at
      the type level**
- [ ] Omitting the slippage bound is a compile error, and a runtime
      `VALIDATION_ERROR` for JS callers — **no permissive default anywhere**
- [ ] An empty `path` array is accepted as "direct", not rejected as missing
- [ ] No code path can send an asset the caller did not name (no XLM fallback)
- [ ] `op_under_dest_min` / `op_over_source_max` surface as a distinct, actionable error
- [ ] `status` derived from `res.successful`
- [ ] All wallet and network guards match `useSendPayment`
- [ ] Tests cover: both modes, a missing bound, a slippage failure, an empty path,
      and wallet-not-connected — mock the adapter and Horizon
- [ ] Docs explain slippage with a worked example, an explicit tolerance, the
      arithmetic, and a warning about quote staleness
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
- The XLM fallback to avoid: `packages/core/src/hooks/useSendPayment.ts:135-139` (`bug-05`)
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `hook-use-payment-paths` (the quote source), `bug-05`, `bug-10`, `core-05`
- Path payments: https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/path-payments

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
