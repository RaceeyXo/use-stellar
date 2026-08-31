---
name: "Enhancement: generic-typed useSorobanContract and correct ScVal conversion"
about: The hook returns unknown, guesses XDR types wrong, and simulates from a stranger's address
title: "feat(hook): generic-typed useSorobanContract and spec-aware ScVal conversion"
labels: enhancement, hook, soroban, help wanted
---

## Generic-typed `useSorobanContract` and spec-aware `ScVal` conversion

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days
**Depends on:** `bug-01`

---

### Context

Soroban contracts are strongly typed. A function declaring `u32` will reject a
`u64` with a host type error, and `Symbol`, `String`, and `Address` are three
distinct types even though all three look like a JavaScript string.

`useSorobanContract` tries to bridge that gap by inferring XDR types from
JavaScript values. Inference cannot work here — the information simply is not
present in the JS value — so it guesses, and the guesses are wrong in several
common cases.

---

### The gap, part 1 — no types

`packages/core/src/hooks/useSorobanContract.ts:16-21`

```ts
export interface UseSorobanContractReturn {
  data: unknown | null
  // …
}
```

`unknown | null` collapses to plain `unknown`. There is no generic parameter, so
every consumer casts at the call site.

### The gap, part 2 — `toScVal` guesses wrong

`packages/core/src/hooks/useSorobanContract.ts:23-42`

```ts
function toScVal(arg: unknown): xdr.ScVal {
  if (arg instanceof xdr.ScVal) return arg
  if (typeof arg === "string") return xdr.ScVal.scvString(arg)
  if (typeof arg === "boolean") return xdr.ScVal.scvBool(arg)
  if (typeof arg === "number") {
    if (!Number.isInteger(arg)) throw new Error(…)
    return arg < 0
      ? xdr.ScVal.scvI128(new xdr.Int128Parts({
          hi: xdr.Int64.fromString("-1"),
          lo: xdr.Uint64.fromString(String(BigInt(arg) & BigInt("0xFFFFFFFFFFFFFFFF"))),
        }))
      : xdr.ScVal.scvU64(xdr.Uint64.fromString(String(arg)))
  }
  throw new Error(…)
}
```

- **Every positive integer becomes `scvU64`.** A contract expecting `u32`, `i128`,
  or `u128` gets a host type error.
- **Every string becomes `scvString`.** A contract expecting `Symbol` or `Address`
  gets a type error. `Address` is the common case — every token contract's
  `balance(address)` takes one.
- **Negative numbers build `Int128Parts` with `hi` pinned to `-1`**, which is
  correct only for values above −2⁶⁴.
- **Numbers beyond `MAX_SAFE_INTEGER` lose precision before conversion** — the
  `number` is already wrong by the time `toScVal` sees it. Same class of bug as
  `bug-06`.

### The gap, part 3 — hardcoded source account

`packages/core/src/hooks/useSorobanContract.ts:98-101`

```ts
const sourceAccount = new Account("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", "0")
```

Simulation runs as a stranger. Any result that depends on the caller —
`require_auth`, a balance read, anything permission-gated — is simulated for the
wrong account and is simply wrong for the actual user.

---

### Why this matters

A developer calling a standard token contract's `balance(Address)` gets a host
type error they cannot diagnose from the message, because the hook silently
converted their address string to `scvString`. The workaround — pass `xdr.ScVal`
directly — works but is undocumented, so nobody finds it.

---

### Where this lives

- Hook: `packages/core/src/hooks/useSorobanContract.ts`
- Test: `packages/core/src/hooks/useSorobanContract.test.ts`
- Types: `packages/core/src/types/index.ts` (`ContractCallOptions`)
- Export: `packages/core/src/index.ts`
- Docs: `docs/hooks/use-soroban-contract.md`

---

### Implementation guidelines

- **Make the hook generic:** `useSorobanContract<T = unknown>(…): { data: T | null, … }`.
  Default `unknown` so this is not a breaking change.
- **Make `xdr.ScVal[]` the primary path.** Values passed as `ScVal` go through
  untouched — the existing `instanceof` check at line 24 already does this; make it
  the documented main road rather than the escape hatch.
- **Stop guessing.** Two acceptable approaches, pick one and justify it:
  - Accept a `ContractSpec` (the SDK can parse a contract's spec XDR) and convert
    against the declared parameter types. Correct by construction, more work.
  - Keep an inference helper for **unambiguous** cases only (`boolean`, `bigint`
    with an explicit type tag) and **throw a clear error naming the expected XDR
    type** for anything ambiguous — a bare `number` or `string` should be a loud,
    actionable error, not a silent wrong guess.

  Either way: **an ambiguous value must never be silently converted.**

- Fix the negative-number path or remove it. `Int128Parts` with a hardcoded `hi` is
  correct only in a narrow range; use the SDK's own `nativeToScVal` / `ScInt`
  helpers rather than hand-building parts.
- **Default the simulation source to `wallet.address`** when connected, falling
  back to a documented placeholder when not. Document that simulations run
  anonymously give wrong results for auth-dependent calls, and that the placeholder
  address exists only so a read can be attempted before connect.
- Land **`bug-01`** first — its `args` serialization work touches the same
  dependency array, and doing both at once means resolving the same conflict twice.
- The docs page must show the `xdr.ScVal` path first, with `Address` and `Symbol`
  examples, since those are the two the current inference gets wrong most often.

---

### Acceptance criteria

- [ ] `useSorobanContract<Balance>()` returns `Balance | null` with no cast at the
      call site
- [ ] The default type parameter keeps existing callers compiling unchanged
- [ ] `xdr.ScVal[]` args pass through untouched
- [ ] **Ambiguous JS values throw a clear error naming the expected XDR type**
      instead of guessing
- [ ] No value beyond `MAX_SAFE_INTEGER` can be silently truncated
- [ ] Negative integers convert correctly across the full i128 range, or the path
      is removed in favour of the SDK's helpers
- [ ] Simulation source defaults to the connected wallet address
- [ ] The anonymous-simulation caveat is documented
- [ ] Tests cover: `Address`, `Symbol`, `u32`, `i128`, a negative value, an
      out-of-range number, and the typed return
- [ ] `docs/hooks/use-soroban-contract.md` leads with the `ScVal` path
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

- The return type: `packages/core/src/hooks/useSorobanContract.ts:16-21`
- The converter: `packages/core/src/hooks/useSorobanContract.ts:23-42`
- The hardcoded source: `packages/core/src/hooks/useSorobanContract.ts:98-101`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `bug-01` (land first), `hook-use-soroban-write`, `bug-06` (the precision trap)
- Soroban types: https://developers.stellar.org/docs/learn/encyclopedia/contract-development/types/built-in-types
- SDK `nativeToScVal`: https://stellar.github.io/js-stellar-sdk/global.html#nativeToScVal

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
