---
name: "Bug 07: Address validation uses a regex instead of StrKey"
about: isValidStellarAddress accepts garbage and rejects valid muxed and contract addresses
title: "fix(utils): validate addresses with StrKey instead of a regex"
labels: bug, good first issue
---

## Validate addresses with `StrKey`, not a regex

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

A Stellar address is a **strkey**: a version byte, a 32-byte payload, and a
**CRC16 checksum**, all base32-encoded. The base32 alphabet used is RFC 4648
without padding, which excludes the characters `0`, `1`, `8`, and `9` precisely so
they cannot be confused with `O`, `I`, `B`, and `g`.

The checksum is the point. It is what lets a wallet catch a typo before a user
sends money into a black hole. A length-and-prefix regex checks neither the
alphabet nor the checksum.

There are also three address types a payment destination can legitimately be:

| Prefix | Type | Notes |
|---|---|---|
| `G…` | Ed25519 public key | The ordinary account address |
| `M…` | Muxed account | One underlying account, many logical sub-accounts — how exchanges do deposits |
| `C…` | Contract | A Soroban contract address |

---

### The defect

`packages/core/src/utils/index.ts:87-89`

```ts
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address)
}
```

Wrong in both directions, both reproduced:

- **Accepts garbage.** `[A-Z0-9]` includes `0`, `1`, `8`, and `9`, which are not in
  the base32 alphabet, and there is no checksum check at all. `"G" + "0".repeat(55)`
  passes.
- **Rejects valid addresses.** `M…` and `C…` are valid destinations and are
  rejected outright.

`useAccountExists` uses this to report `reason: "invalid_format"`, so it lies to
the user in both directions — telling them a garbage address is fine, and telling
them a real muxed address is malformed.

Note the contrast: `useSorobanContract.ts:44-46` gets the alphabet right
(`/^C[A-Z2-7]{55}$/`) but still skips the checksum. Both should go through the SDK.

---

### Why this matters

This is the function a consumer calls before letting a user hit "Send". It is the
last line of defence against a mistyped address, and it does not actually check
anything the SDK's own validator checks.

---

### Where this lives

- Utility: `packages/core/src/utils/index.ts`
- Consumer: `packages/core/src/hooks/useAccountExists.ts`
- Export: `packages/core/src/index.ts:65`
- Test: `packages/core/src/utils/index.test.ts` (create if absent)

---

### Suggested API

```ts
export type StellarAddressType = "ed25519" | "muxed" | "contract"

/** Narrow the address to its strkey type, or `null` if it is not a valid address. */
export function getAddressType(address: string): StellarAddressType | null

/** True for any address use-stellar accepts as a payment destination. */
export function isValidStellarAddress(address: string): boolean
```

---

### Implementation guidelines

- Use the SDK's own validators — import `StrKey` from `@stellar/stellar-sdk`:
  - `StrKey.isValidEd25519PublicKey(address)` → `"ed25519"`
  - `StrKey.isValidMed25519PublicKey(address)` → `"muxed"`
  - `StrKey.isValidContract(address)` → `"contract"`

  All three do the alphabet and checksum work for you. Do not reimplement CRC16.
- Implement `getAddressType` as the primitive and define `isValidStellarAddress`
  in terms of it, so callers that need to branch can, and existing callers keep a
  boolean.
- **`isValidStellarAddress` is a public export** (`index.ts:65`). Widening it to
  accept `M…` and `C…` is a behaviour change — call it out in the PR description
  and add a line to `CHANGELOG.md`. Export `getAddressType` and
  `StellarAddressType` from `index.ts` too.
- Update `useAccountExists` so `reason: "invalid_format"` is only reported when
  `getAddressType` returns `null`.
- Guard against non-string input — the SDK validators throw on some malformed
  values rather than returning `false`. Wrap in a `try`/`catch` or check
  `typeof address === "string"` first, and test that path.
- Full muxed **support** (resolving `M…` to its underlying `G…` for balances and
  history) is explicitly **out of scope** here. This issue makes them validate;
  nothing else in the library understands them yet.

---

### Acceptance criteria

- [ ] `"G" + "0".repeat(55)` returns `false`
- [ ] A real testnet `G…` address returns `true`
- [ ] A one-character-mutated copy of that address returns `false` (checksum works)
- [ ] `M…` and `C…` addresses are handled per `getAddressType`'s documented contract
- [ ] Non-string and empty input returns `false` without throwing
- [ ] `getAddressType` and `StellarAddressType` exported from `packages/core/src/index.ts`
- [ ] `useAccountExists` only reports `invalid_format` when `getAddressType` is `null`
- [ ] `CHANGELOG.md` notes the widened validation
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

- The defect: `packages/core/src/utils/index.ts:87-89`
- The consumer that lies: `packages/core/src/hooks/useAccountExists.ts`
- A near-miss in the same repo: `packages/core/src/hooks/useSorobanContract.ts:44-46`
- SDK `StrKey`: https://stellar.github.io/js-stellar-sdk/StrKey.html
- Muxed accounts (SEP-23): https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md

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
