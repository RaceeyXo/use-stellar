---
name: "Core 03: Custom network passphrases are unsupported"
about: A hardcoded testnet/mainnet ternary is copy-pasted in five places, blocking futurenet and local nodes
title: "feat(core): support custom network passphrases (futurenet, standalone)"
labels: enhancement, bug, security
---

## Support custom network passphrases

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

The **network passphrase** is what binds a signature to a network. It is mixed
into the transaction hash before signing, so the same envelope signed with the
testnet passphrase is invalid on mainnet and vice versa. This is Stellar's replay
protection between networks, and it is why the passphrase must be exactly right.

Stellar has more than two networks. Futurenet is where new protocol features land
before testnet. A local quickstart or standalone container generates its own
passphrase. Both are normal development targets.

---

### The defect

`StellarNetwork` is only two values — `packages/core/src/types/index.ts:10`:

```ts
export type StellarNetwork = "testnet" | "mainnet"
```

And this ternary is copy-pasted in three hooks:

```ts
networkConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
```

- `packages/core/src/hooks/useSendPayment.ts:75-76`
- `packages/core/src/hooks/useAddTrustline.ts:81-82`
- `packages/core/src/hooks/useSorobanContract.ts:102-103`

with a fourth copy in `packages/core/src/wallets/freighterAdapter.ts` (the
`NETWORK_PASSPHRASES` map) and a fifth inline in
`packages/core/src/hooks/useWallet.ts:131-137`, which compares passphrase string
literals directly:

```ts
if (networkDetails.networkPassphrase === "Public Global Stellar Network ; September 2015") {
  return "mainnet"
}
if (networkDetails.networkPassphrase === "Test SDF Network ; September 2015") {
  return "testnet"
}
throw new Error("Unknown Stellar network")
```

Note the shape of that ternary: **anything that is not `"mainnet"` gets the
testnet passphrase.** There is no error path.

---

### Why this matters

A user who points `networkConfig` at futurenet or a local standalone node gets
transactions signed with the **testnet passphrase**. They are rejected by the
target network — and the rejection is opaque, because nothing in the library
suspects the passphrase.

Local development against a standalone node is impossible today, which blocks the
whole "clone it and run it locally" contributor story this project depends on.

`bug-04` fixes the sibling problem — the custom `horizonUrl` being ignored. The two
together are what "custom network support" actually means.

---

### Where this lives

- Types: `packages/core/src/types/index.ts` (`StellarNetwork`, `NetworkConfig`,
  `CustomNetworkConfig`, `NETWORK_CONFIGS`)
- Provider: `packages/core/src/context/StellarProvider.tsx`
- Hooks: `useSendPayment.ts`, `useAddTrustline.ts`, `useSorobanContract.ts`,
  `useWallet.ts`
- Wallets: `packages/core/src/wallets/freighterAdapter.ts`,
  `packages/core/src/wallets/albedoAdapter.ts`
- Docs: `docs/guides/networks.md`
- Tests: the corresponding test files

---

### Implementation guidelines

- **Add `networkPassphrase` to `NetworkConfig`** and resolve it **once** in
  `StellarProvider.resolveNetworkConfig` (`StellarProvider.tsx:47-79`), alongside
  the URL validation that already lives there. Every consumer then reads it from
  context.
- **Delete all five hardcoded copies.** The acceptance criterion is a grep count of
  zero — do not leave one "just for the default case".
- Widen `StellarNetwork`. Two shapes are reasonable:
  - `"testnet" | "mainnet" | "futurenet" | "custom"` — explicit, keeps the
    common names ergonomic, needs `NETWORK_CONFIGS` entries for the new ones.
  - Keep the union narrow and let `networkConfig` carry everything for custom
    networks.

  Pick one, justify it in the PR, and make sure the wallet adapters can express it —
  `WalletNetworkDetails` (`wallets/types.ts:26-29`) already carries both a
  `network` and a `networkPassphrase`, so the adapter layer is mostly ready.
- **The `useWallet` passphrase comparison must stop being a string-literal ladder.**
  Compare against the resolved config's passphrase, and make an unrecognised
  passphrase a typed `StellarError`, not a bare `new Error`.
- **Never default a passphrase silently.** If a custom network is configured
  without a passphrase, throw at provider render — the same way the existing URL
  validation does. Signing with the wrong passphrase must not be reachable.
- This is a public type change. `CHANGELOG.md` entry required, and
  `docs/reference/types.md` needs updating.
- Land after **`bug-04`** if both are in flight; they touch the same resolution
  path in `StellarProvider`.

---

### Acceptance criteria

- [ ] **Zero occurrences** of `Networks.PUBLIC : Networks.TESTNET` remain —
      `grep -rn "Networks.PUBLIC" packages/core/src` shows only the resolver
- [ ] `networkPassphrase` is part of `NetworkConfig` and resolved once in the provider
- [ ] A provider configured with a custom passphrase signs with **that** passphrase
- [ ] A custom network with no passphrase throws at provider render
- [ ] `useWallet` no longer compares passphrase string literals inline
- [ ] An unrecognised wallet passphrase produces a typed `StellarError`
- [ ] Futurenet documented as a supported target in `docs/guides/networks.md`
- [ ] `CHANGELOG.md` and `docs/reference/types.md` updated
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

- The type: `packages/core/src/types/index.ts:10`
- The five copies: `useSendPayment.ts:75-76`, `useAddTrustline.ts:81-82`,
  `useSorobanContract.ts:102-103`, `wallets/freighterAdapter.ts`, `useWallet.ts:131-137`
- Where resolution should live: `packages/core/src/context/StellarProvider.tsx:47-79`
- Related: `bug-04` (the custom `horizonUrl` half of the same story)
- Network passphrases: https://developers.stellar.org/docs/learn/fundamentals/networks

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
