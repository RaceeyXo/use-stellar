---
name: "Bug 06: formatAmount corrupts amounts with float math"
about: The only exported amount formatter loses precision and eats trailing integer zeros
title: "fix(utils): formatAmount corrupts amounts with float math"
labels: bug, critical, good first issue
---

## `formatAmount` corrupts amounts with float math

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Stellar amounts are **int64 stroops**. One XLM is 10,000,000 stroops, so every
amount has exactly 7 decimal places and the maximum representable balance is
`922,337,203,685.4775807` (2⁶³−1 stroops). Horizon returns amounts as **strings**
precisely so they survive the trip without going through a float.

`formatAmount` is the library's only exported amount formatter — consumers use it
for every balance and every payment row. It parses those strings into a JavaScript
`number`, which is an IEEE-754 double with 53 bits of mantissa. int64 does not fit
in 53 bits.

---

### The defect

`packages/core/src/utils/index.ts:97-101`

```ts
export function formatAmount(amount: string, decimals = 7): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return "0"
  return num.toFixed(decimals).replace(/\.?0+$/, "")
}
```

Two independent bugs, both reproduced:

**1. Float precision loss.**

```
formatAmount("922337203685.4775807")  →  "922337203685.4775391"
```

A legal Stellar balance, silently corrupted. The error is in the 7th decimal —
large enough to matter and small enough that nobody notices until an accounting
reconciliation fails.

**2. The trim regex is unanchored.**

```
formatAmount("2500", 0)  →  "25"
```

`/\.?0+$/` makes the decimal point optional, so when `toFixed(0)` returns `"2500"`
with no decimal point at all, the regex happily eats the trailing **integer**
zeros. 2500 XLM renders as 25 XLM.

---

### Why this matters

Any UI built on this displays wrong balances. Bug 2 is the more visible one — it
turns 2500 into 25 on screen, a 100× error, in the one function every consumer
calls to render money.

---

### Where this lives

- Utility: `packages/core/src/utils/index.ts`
- Test: `packages/core/src/utils/index.test.ts` (create if absent)
- Export: already exported from `packages/core/src/index.ts:67`

---

### Implementation guidelines

- **Never parse an amount to `number`.** Do the work on the string, or on `BigInt`
  stroops. The algorithm:
  1. Validate the input matches `/^-?\d+(\.\d+)?$/`. Anything else returns `"0"`
     (preserve today's `isNaN` behaviour so this is not a breaking change).
  2. Split on `.` into integer and fraction parts.
  3. Pad or truncate the fraction to `decimals` characters. Truncation, not
     rounding, is the safer default for money — but whichever you choose,
     **document it in the JSDoc**, because the current `toFixed` rounds.
  4. Strip trailing zeros **only from the fraction part**, then drop the `.` if the
     fraction is now empty. Reassemble.
- If you prefer `BigInt`: parse to stroops, then re-insert the decimal point by
  string slicing. Either approach is fine; neither may touch `Number`.
- Handle the edge cases explicitly: `decimals = 0`, a negative amount, an amount
  with more than 7 decimals supplied, `"0"`, `""`, and the int64 boundary in both
  directions.
- Add a test that walks the int64 range boundaries: `"922337203685.4775807"`,
  `"-922337203685.4775808"`, `"0.0000001"` (one stroop), and
  `"0.00000001"` (sub-stroop — decide and document what happens).
- While you are in the file, check `shortenAddress` (`utils/index.ts:91-94`) is not
  doing anything similar. It is not, but confirm rather than assume.

---

### Acceptance criteria

- [ ] `formatAmount("922337203685.4775807")` returns the input unchanged
- [ ] `formatAmount("2500", 0)` returns `"2500"`
- [ ] `formatAmount("0.0000001")` returns `"0.0000001"` (one stroop)
- [ ] `formatAmount("1.5000000")` returns `"1.5"`
- [ ] `formatAmount("not a number")` still returns `"0"`
- [ ] **No `parseFloat`, `Number(…)`, `+amount`, or `toFixed` on an amount anywhere
      in `utils/index.ts`**
- [ ] Rounding-vs-truncation behaviour documented in the JSDoc
- [ ] Tests cover the int64 boundaries in both directions
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

- The defect: `packages/core/src/utils/index.ts:97-101`
- Sibling issue in the same file: `bug-07` (address validation)
- Stellar amount precision: https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets#amount-precision
- `IEEE-754` mantissa limits: `Number.MAX_SAFE_INTEGER` is 2⁵³−1; stroops go to 2⁶³−1

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
