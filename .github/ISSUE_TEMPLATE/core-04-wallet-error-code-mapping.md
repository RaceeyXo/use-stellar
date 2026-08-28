---
name: "Core 04: Wallet adapter error codes are dropped"
about: WalletAdapterError carries a precise code that toStellarError never reads
title: "fix(errors): wallet adapter error codes are dropped on the floor"
labels: bug, wallet
---

## Wallet adapter error codes are dropped on the floor

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

The wallet layer defines its own precise error taxonomy —
`packages/core/src/wallets/types.ts:3-18`:

```ts
export type WalletAdapterErrorCode =
  | "wallet_unavailable"
  | "wallet_unsupported"
  | "wallet_access_rejected"
  | "wallet_network_mismatch"
  | "wallet_sign_failed"

export class WalletAdapterError extends Error {
  constructor(
    public readonly code: WalletAdapterErrorCode,
    message: string
  ) {
    super(message)
    this.name = "WalletAdapterError"
  }
}
```

Every adapter throws these with the right code. The error then passes through
`toStellarError` on its way to the consumer.

---

### The defect

`packages/core/src/errors/factory.ts:50-124` — `toStellarError` never inspects
`.code`. Its precedence chain is:

1. Already a `StellarError` → pass through
2. Horizon `result_codes`
3. HTTP status
4. **`.message` substring heuristics**
5. Transport heuristics
6. `UNKNOWN`

A `WalletAdapterError` is none of 1–3, so it is classified by matching English
prose against a list of substrings.

Concretely:

| Adapter code | Message it carries | Classified as | Should be |
|---|---|---|---|
| `wallet_network_mismatch` | "Wrong network. Switch Freighter to testnet…" | `UNKNOWN` | `WRONG_NETWORK` |
| `wallet_unsupported` | "LOBSTR is not supported yet." | `UNKNOWN` | needs a code |
| `wallet_unavailable` | varies | `UNKNOWN` or `WALLET_NOT_INSTALLED` if the wording happens to match | `WALLET_NOT_INSTALLED` |
| `wallet_access_rejected` | "User declined access" | `WALLET_REQUEST_REJECTED` — **by luck**, because "declined" is in the substring list at line 93 | `WALLET_REQUEST_REJECTED` |
| `wallet_sign_failed` | varies | `UNKNOWN` | needs a code |

`WRONG_NETWORK` already exists in `errors/codes.ts:17` and is never produced by
this path. The one code that *does* come out right does so because of a substring
match on the message text — change the wording and it breaks.

---

### Why this matters

Consumers branch on `err.code`. When every wallet failure arrives as `UNKNOWN`, no
app can distinguish "switch your network" from "install the extension" from "this
wallet isn't supported". They all render the same generic failure, which is the
opposite of what a typed error taxonomy is for.

The stub adapters for LOBSTR and Rabet (`wallets/registry.ts:38-39`) throw
`wallet_unsupported` on every call, so this is the *first* error many users hit.

---

### Where this lives

- Errors: `packages/core/src/errors/factory.ts`, `packages/core/src/errors/codes.ts`
- Wallets: `packages/core/src/wallets/types.ts`
- Test: `packages/core/src/errors/factory.test.ts`
- Docs: `docs/guides/error-handling.md`

---

### Implementation guidelines

- **Map `WalletAdapterErrorCode → StellarErrorCode` as the first check** in
  `toStellarError`, immediately after the existing `StellarError` pass-through at
  lines 52-58 and **before** any Horizon or heuristic branch. A code we set
  ourselves is the most reliable signal available and must outrank everything else.
- Detect it structurally, not by `instanceof` alone — a `WalletAdapterError` that
  has crossed a bundle boundary may fail `instanceof`. Check for
  `name === "WalletAdapterError"` and a `code` that is a member of the union, the
  same way `isStellarError` handles the equivalent problem at `factory.ts:55`.
- **Every member of the union needs a destination code.** Two have no good target
  today:
  - `wallet_unsupported` — needs a new code (`WALLET_UNSUPPORTED`)
  - `wallet_sign_failed` — needs a new code (`SIGNING_FAILED`)

  Add them to `codes.ts` with entries in `DEFAULT_ERROR_MESSAGES`. Coordinate with
  **`core-05`**, which adds a batch of codes to the same file — whoever lands
  second rebases rather than duplicating the constant.
- Preserve the original message. `createStellarError(code, message)` accepts one —
  pass the adapter's message through so the user still sees "Switch Freighter to
  testnet" rather than a generic default.
- Write a **table test** over the full taxonomy, so a future adapter code added to
  the union without a mapping fails the suite. A `Record<WalletAdapterErrorCode,
  StellarErrorCode>` map makes this exhaustive at the type level too — TypeScript
  will refuse to compile if a member is missing.
- Add the mapping table to `docs/guides/error-handling.md`.

---

### Acceptance criteria

- [ ] Every member of `WalletAdapterErrorCode` maps to a specific, **non-`UNKNOWN`**
      `StellarErrorCode`
- [ ] The mapping is the first check in `toStellarError`, before all heuristics
- [ ] `wallet_network_mismatch` → `WRONG_NETWORK`
- [ ] New codes added for `wallet_unsupported` and `wallet_sign_failed`
- [ ] The adapter's original message survives the conversion
- [ ] A table test covers the full taxonomy, and the mapping is exhaustive at the
      type level (adding a union member without a mapping fails `pnpm typecheck`)
- [ ] `docs/guides/error-handling.md` gains the mapping table
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

- The taxonomy: `packages/core/src/wallets/types.ts:3-18`
- The factory that ignores it: `packages/core/src/errors/factory.ts:50-124`
- The existing structural type guard to model on: `packages/core/src/errors/factory.ts:55`
- The stubs that throw `wallet_unsupported`: `packages/core/src/wallets/registry.ts:7-9,38-39`
- Related: `core-05` (same file, coordinate), `core-06` (removing the heuristics),
  `bug-08` (the `WRONG_NETWORK` path this unblocks)

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
