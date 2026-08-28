---
name: "New hook: useFriendbot"
about: One-call testnet funding so developers never leave the app to fund an account
title: "feat(hook): useFriendbot — one-call testnet funding"
labels: enhancement, hook, good first issue
---

## New hook: `useFriendbot`

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

Friendbot is the SDF's testnet faucet. A single `GET` request funds any testnet
address with 10,000 test XLM and, if the account does not exist yet, creates it:

```
GET https://friendbot.stellar.org?addr=<address>
```

It exists **only on testnet and futurenet**. There is no mainnet equivalent, and
there never will be.

Today the README tells developers to leave the app, open Stellar Laboratory, paste
their address, and click a button. Every Stellar tutorial says the same thing.
This hook removes the detour and makes "run the demo" a single click.

This is the best first issue in the whole backlog: one file, one endpoint, an
obvious correct answer, and a visible payoff in the demo.

---

### Why this matters

The first five minutes with a Stellar library decide whether a developer keeps
going. Right now those five minutes involve a browser tab, a copy-paste, and a
third-party UI. A `fund()` button in the demo is a materially better first
impression, and it makes the quickstart docs shorter and testable.

---

### Where this lives

- Hook: `packages/core/src/hooks/useFriendbot.ts`
- Test: `packages/core/src/hooks/useFriendbot.test.tsx`
- Types: add to `packages/core/src/types/index.ts` if needed
- Export: add to `packages/core/src/index.ts`
- Demo: `packages/demo/` — wire up a "Fund account" button
- Docs: `docs/hooks/use-friendbot.md`, and the README's "Fund Your Account" section

---

### Suggested API

```ts
export interface UseFriendbotReturn {
  /** Defaults to the connected wallet address. */
  fund: (address?: string) => Promise<void>
  loading: boolean
  error: StellarError | null
  funded: boolean
}
```

---

### Implementation guidelines

- **Must throw on mainnet.** Read `network` from `useStellarContext()` and throw
  `createStellarError("VALIDATION_ERROR", …)` when it is `"mainnet"`. Friendbot
  does not exist there, so the request would fail with a confusing network error
  instead of an explanation. This is the single most important line in the hook.
- Derive the friendbot URL from the network rather than hardcoding one string —
  futurenet has its own faucet endpoint. If `core-03` has landed and added more
  networks, handle them; otherwise cover testnet and leave futurenet as a linked
  follow-up.
- Default the address to `wallet.address` from context, matching `useBalance`'s
  `address ?? wallet.address` pattern (`useBalance.ts:47`). Throw
  `WALLET_NOT_CONNECTED` when neither is available.
- **Validate the address before spending a request.** Use `getAddressType` from
  `bug-07` if it has landed, or `StrKey.isValidEd25519PublicKey` directly.
- Friendbot returns 400 when the account already exists. That is not really a
  failure — surface it as a distinct, clearly-worded error rather than a generic
  one, so the UI can say "already funded" instead of "something went wrong".
- Route all errors through `toStellarError`. Guard the state updates against
  unmount the way the other hooks do.
- **Wire it into `packages/demo`** so the demo can self-fund. That is part of this
  issue, not a follow-up — it is how the payoff gets demonstrated.
- Replace the README's "Fund Your Account" instructions with the hook.

---

### Acceptance criteria

- [ ] `useFriendbot` implemented and exported from `packages/core/src/index.ts`
- [ ] **Throws `VALIDATION_ERROR` when the provider network is `mainnet`** — before
      any request is made
- [ ] Defaults to `wallet.address`; throws `WALLET_NOT_CONNECTED` when there is none
- [ ] Rejects an invalid address before spending a request
- [ ] An already-funded account produces a clear, distinct error
- [ ] `funded` reflects a successful funding
- [ ] Tests cover: success, mainnet rejection, no address, invalid address, and an
      already-funded response — mock the HTTP call, never hit the network
- [ ] Wired into `packages/demo` with a working "Fund account" button
- [ ] README's "Fund Your Account" section replaced with the hook
- [ ] `docs/hooks/use-friendbot.md` follows `docs/example.md`
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

- Address-defaulting pattern: `packages/core/src/hooks/useBalance.ts:47`
- Network from context: `packages/core/src/context/StellarProvider.tsx`
- Error codes: `packages/core/src/errors/codes.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `bug-07` (address validation), `core-03` (futurenet),
  `hook-use-create-account` (the mainnet equivalent)
- Friendbot: https://developers.stellar.org/docs/learn/fundamentals/networks#friendbot

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
