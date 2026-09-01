---
name: "Enhancement: wallet reconnect, live wallet events, and an open adapter registry"
about: A page refresh drops the wallet, wallet-side changes go unnoticed, and third parties cannot add an adapter
title: "feat(core): wallet session restore, wallet change events, and an extensible adapter registry"
labels: enhancement, help wanted
---

## Wallet session restore, live events, and an open adapter registry

**Complexity:** High (200 points)
**Estimated time:** 4 days
**Depends on:** `bug-08` (the network-mismatch guard) — land it first

---

### Context

Three related gaps in the wallet layer, all rooted in the same place.

**1. A refresh loses the wallet.** `useWallet` keeps everything in provider state
(`useWallet.ts:47-56`) and nothing else. Reload the page and `connected` is
`false`, `address` is `null`, and the user has to click Connect and approve in
their extension again. Every wallet UI in the ecosystem restores its session; this
one cannot.

**2. Changes made _in_ the wallet are invisible.** The only way state is refreshed
is `refreshWalletNetwork()`, and it does two things wrong:

```ts
// packages/core/src/hooks/useWallet.ts:85-88
const refreshWalletNetwork = useCallback(async () => {
  if (!wallet.connected || wallet.wallet !== "freighter") {
    return
  }
```

It is **Freighter-only** — for an Albedo user it returns immediately and does
nothing — and it only exists because there is no event subscription. If the user
switches account or network inside their extension, the app finds out only if the
consumer happens to call `refreshWalletNetwork()` at the right moment. Freighter's
API exposes a watcher for exactly this.

It also hand-rolls the passphrase→network mapping (`useWallet.ts:131-137`) and
throws `"Unknown Stellar network"` on anything else, even though every adapter
already implements `getNetworkDetails()` and could answer the question generically.

**3. The adapter registry is closed.** `WALLET_ADAPTERS` is a module-private const
(`registry.ts:34-39`) with `lobstr` and `rabet` wired to `createUnsupportedAdapter`.
Adding a wallet requires a PR to this repo — there is no way for an application, or
a wallet vendor, to register their own. And `getWalletAdapter` has no guard:

```ts
// packages/core/src/wallets/registry.ts:41-43
export function getWalletAdapter(walletType: WalletType): WalletAdapter {
  return WALLET_ADAPTERS[walletType]
}
```

Called with anything outside the union — which TypeScript cannot prevent at a
JavaScript call site or when the value comes from `localStorage` — it returns
`undefined`, and the caller gets `TypeError: Cannot read properties of undefined
(reading 'connect')` instead of a real error.

---

### Why this matters

The refresh problem is the one users feel every session. The event problem is
worse but quieter: a user switches from testnet to mainnet in their extension, the
app keeps showing testnet state, and `bug-08`'s mismatch guard cannot save them
because it compares two values that are already equal. The registry problem is why
`@lobstrco/signer-extension-api` sits in `dependencies` shipping to every consumer
while `lobstr` is still a stub (see `pkg-02`).

---

### Where this lives

- `packages/core/src/hooks/useWallet.ts`
- `packages/core/src/wallets/registry.ts`
- `packages/core/src/wallets/types.ts` (adapter contract)
- `packages/core/src/context/StellarProvider.tsx` (opt-in options)
- `packages/core/src/hooks/useWallet.test.tsx`, `packages/core/src/wallets/registry.test.ts`
- `docs/guides/wallets.md`

---

### Implementation guidelines

Three parts. They can land as three commits in one PR; say in the PR description
which part each commit is.

**Part 1 — session restore**

- Persist only what is safe: the **wallet type** and, optionally, the address.
  Never persist anything secret; a wallet adapter holds no key material and this
  hook must not start.
- On mount, if a stored wallet type exists, call the adapter's `isAvailable()` and
  reconnect **only if the wallet can reconnect without a fresh user prompt**. An
  autoconnect that pops an approval dialog on every page load is worse than no
  autoconnect. If a prompt would be required, restore the _intent_ (pre-select the
  wallet) rather than the connection.
- Make it opt-in via a provider option, defaulting to off, so this is not a
  behaviour change for existing consumers.
- Guard every storage access with `isBrowser()` and a `try/catch` — `localStorage`
  throws in private-mode and sandboxed contexts.
- Validate what comes back out of storage before using it. A stored value is
  attacker-influenced input in an XSS scenario and is exactly the `undefined`
  adapter case above.

**Part 2 — wallet change events**

- Subscribe to the wallet's own change notifications where the adapter supports it.
  Freighter exposes a watcher in `@stellar/freighter-api` v6 that reports account
  and network changes; wire it through rather than polling.
- Do this **through the adapter contract**, not in `useWallet`. Add an optional
  `subscribe?: (handler) => () => void` to `WalletAdapter`
  (`wallets/types.ts:41-48`). Adapters that cannot report changes simply omit it —
  no `if (wallet.wallet === "freighter")` branch anywhere.
- Unsubscribe on unmount and on disconnect. A leaked subscription that calls
  `setWallet` after unmount is a React warning and a memory leak.
- **`walletNetwork` must reflect the wallet's actual network.** Today
  `useWallet.ts:55` assigns `walletNetwork: connection.network` — the network that
  was _requested_, so it always matches and the mismatch check never fires. That is
  `bug-08`; land it first, then keep this correct as events arrive.
- Replace the hand-rolled passphrase ladder (`useWallet.ts:131-137`) with the
  adapter's `getNetworkDetails()`. Do not throw on an unrecognised passphrase —
  return it as a custom network. `core-03` is adding custom-passphrase support and
  this throw would defeat it.

**Part 3 — open registry**

- Add a guard to `getWalletAdapter`: an unknown type returns a clear
  `WalletAdapterError("wallet_unsupported", ...)` rather than `undefined`.
- Add `registerWalletAdapter(adapter)` so an application can supply its own,
  keyed by `adapter.metadata.type`. Widen `WalletType` to
  `"freighter" | "lobstr" | "albedo" | "rabet" | (string & {})` so custom types
  typecheck without losing autocomplete on the built-in ones.
- Refuse to silently overwrite a registered adapter — that is how two libraries
  fight over the same key and the loser fails at runtime. Throw, or require an
  explicit override flag.
- Export the registration function and the `WalletAdapter` type from
  `packages/core/src/index.ts` — an extension point nobody can import is not one.

Out of scope: implementing the LOBSTR or Rabet adapters. This issue makes them
possible from outside; the adapters themselves are separate issues.

---

### Acceptance criteria

- [ ] With autoconnect enabled, a reload restores the connection without a new
      approval prompt — and when a prompt _would_ be needed, it restores intent
      only and does not prompt
- [ ] Autoconnect is opt-in and off by default
- [ ] A `localStorage` read that throws does not break mount
- [ ] A corrupted or unknown stored wallet type is discarded, not passed to the
      registry
- [ ] Changing account in the wallet extension updates `address` with no user action
- [ ] Changing network in the wallet extension updates `walletNetwork` and makes
      `isNetworkMismatch` true
- [ ] Subscriptions are torn down on unmount and on disconnect; a test asserts no
      `setWallet` runs after unmount
- [ ] No `wallet.wallet === "freighter"` branch remains in `useWallet.ts`
- [ ] The passphrase ladder is gone; network resolution goes through the adapter
- [ ] An unrecognised network passphrase is returned as custom, not thrown on
- [ ] `getWalletAdapter("nonsense")` throws a `WalletAdapterError`, never returns
      `undefined`
- [ ] A custom adapter can be registered from outside the package and used by
      `connect()`, proven by a test
- [ ] Re-registering an existing type is refused unless explicitly overridden
- [ ] `docs/guides/wallets.md` documents autoconnect and custom adapter registration
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

- Connection state, never persisted: `packages/core/src/hooks/useWallet.ts:47-56`
- The Freighter-only early return: `packages/core/src/hooks/useWallet.ts:85-88`
- The hand-rolled passphrase ladder: `packages/core/src/hooks/useWallet.ts:131-137`
- The unguarded lookup: `packages/core/src/wallets/registry.ts:41-43`
- The closed map and the stubs: `packages/core/src/wallets/registry.ts:34-39`
- Adapter contract to extend: `packages/core/src/wallets/types.ts:41-48`
- Related: `bug-08` (land first), `core-03` (custom passphrases),
  `core-04` (adapter error mapping), `pkg-02` (the unused LOBSTR dependency)
- Freighter API: https://docs.freighter.app/docs/guide/usingFreighterWebApp

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
