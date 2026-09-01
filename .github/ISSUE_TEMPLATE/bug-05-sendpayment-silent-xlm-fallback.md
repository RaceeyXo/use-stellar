---
name: "Bug 05: useSendPayment silently falls back to XLM"
about: A malformed asset makes useSendPayment send native XLM instead of throwing
title: "fix(hooks): never silently fall back to XLM in useSendPayment"
labels: bug, critical, security
---

## Never silently fall back to XLM in `useSendPayment`

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

`useSendPayment` converts the caller's `Asset` — either the string `"XLM"` or an
`{ code, issuer }` object — into an SDK `Asset` instance before building the
payment operation. The conversion has a fallback branch that turns **anything it
does not recognise** into native XLM.

The `Asset` union in `types/index.ts:104` is `NativeAsset | IssuedAsset`. The
fallback exists because `Balance` separately allows `"liquidity_pool_shares"`, and
at some point the two unions were conflated. The comment on the line says so.

---

### The defect

`packages/core/src/hooks/useSendPayment.ts:135-139`

```ts
function toStellarAsset(asset: Asset): StellarAsset {
  if (isNativeAsset(asset)) return StellarAsset.native()
  if (isIssuedAsset(asset)) return new StellarAsset(asset.code, asset.issuer)
  return StellarAsset.native() // fallback for liquidity_pool_shares
}
```

The two guards it relies on are weak (`packages/core/src/utils/index.ts:21-27`):

```ts
export function isNativeAsset(asset: Asset): asset is "XLM" {
  return asset === "XLM"
}

export function isIssuedAsset(asset: Asset): asset is IssuedAsset {
  return typeof asset === "object" && "code" in asset
}
```

`isIssuedAsset` never checks `issuer`. So `{ code: "USDC" }` with no issuer passes
the second guard and constructs `new StellarAsset("USDC", undefined)`, and
anything that is not a string `"XLM"` and not an object with a `code` key —
`undefined`, `null`, `{}`, `"usdc"`, a partially-bound form value — falls straight
through to `StellarAsset.native()`.

---

### Why this matters

A user intending to send 100 USDC sends **100 XLM** instead. Silent. Unrecoverable
on mainnet. TypeScript does not save you here: the value crossing this boundary
usually comes from a form, an API response, or a route param, all of which are
`any` or a cast at the edge.

There is no scenario where this fallback is the right behaviour. A payment hook
that cannot identify the asset must refuse to build the transaction.

---

### Where this lives

- Hook: `packages/core/src/hooks/useSendPayment.ts`
- Sibling with the same pattern: `packages/core/src/hooks/useAddTrustline.ts`
- Guards: `packages/core/src/utils/index.ts:21-27`
- Tests: `packages/core/src/hooks/useSendPayment.test.tsx`

---

### Implementation guidelines

- Replace the fallback with a throw that names the offending value:

  ```ts
  throw createStellarError(
    "VALIDATION_ERROR",
    `Unsupported asset: ${JSON.stringify(asset)}. ` + `Pass "XLM" or { code, issuer }.`
  )
  ```

  Use `createStellarError` from `../errors` — it is already imported in the file at
  line 13. Do **not** throw a bare `new Error`; consumers branch on `err.code`.

- **Tighten `isIssuedAsset`** so a missing or non-string `issuer` is rejected
  rather than silently producing `new StellarAsset("USDC", undefined)`. Both
  `code` and `issuer` must be non-empty strings. Keep it a type guard.
- Validate **before** any network call. The throw must happen before
  `server.loadAccount` at `useSendPayment.ts:74`, so a malformed asset costs the
  user nothing. Today `toStellarAsset` is called at line 78, after the account
  load — moving validation earlier is part of this fix.
- Apply the identical audit to `useAddTrustline.ts`, which shares the pattern.
- These guards are currently **not exported** from `packages/core/src/index.ts`
  (see the export list at `index.ts:62-69`). Leave that alone — exporting them is
  scoped to `hook-use-liquidity-pool`.

---

### Acceptance criteria

- [ ] Passing a malformed asset throws `VALIDATION_ERROR` **before** any Horizon
      request is made
- [ ] `isIssuedAsset` rejects an object with a missing, empty, or non-string
      `issuer`
- [ ] Tests cover: `undefined`, `null`, `{}`, `{ code: "USDC" }` with no issuer,
      `{ issuer: "G…" }` with no code, and the string `"usdc"` (wrong case)
- [ ] A test asserts `server.loadAccount` was **not** called on the invalid-asset
      path
- [ ] No code path in `useSendPayment` can build a native-asset operation unless
      the caller explicitly passed `"XLM"`
- [ ] The same fix applied to `useAddTrustline`
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

- The defect: `packages/core/src/hooks/useSendPayment.ts:135-139`
- The weak guards: `packages/core/src/utils/index.ts:21-27`
- Error codes: `packages/core/src/errors/codes.ts` (`VALIDATION_ERROR`)
- The `Asset` union: `packages/core/src/types/index.ts:104`
- Stellar assets: https://developers.stellar.org/docs/tokens/stellar-asset-contract

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
