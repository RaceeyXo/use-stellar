---
name: "Bug 08: isNetworkMismatch can never be true"
about: The wallet network guard compares a field against itself, so mainnet/testnet drift is never caught
title: "fix(hooks): useWallet.isNetworkMismatch can never be true"
labels: bug, critical, wallet, security
---

## `useWallet.isNetworkMismatch` can never be true

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

A user's wallet extension has its own network setting, chosen inside the
extension, entirely independent of what the app's `StellarProvider` is configured
for. If the app says `testnet` and Freighter says mainnet, every transaction the
user signs is a **real-money mainnet transaction against a testnet-intent UI**.

Catching that drift is the entire job of `isNetworkMismatch`. The `WalletState`
type carries two fields for it (`types/index.ts`): `network` (the network at
connect time) and `walletNetwork` (what the extension reports). The guard compares
them.

---

### The defect

`packages/core/src/hooks/useWallet.ts:47-56` — `connect` assigns both fields the
**same value**:

```ts
setWallet({
  connected: true,
  connecting: false,
  address: connection.address,
  network: connection.network,
  wallet: connection.wallet,
  walletName: adapter.metadata.name,
  error: null,
  walletNetwork: connection.network,   // ← identical to `network`
})
```

`packages/core/src/hooks/useWallet.ts:105-108` — the guard compares those two
identical fields:

```ts
const isNetworkMismatch = useMemo(() => {
  if (!wallet.connected || !wallet.walletNetwork) return false
  return wallet.network !== wallet.walletNetwork
}, [wallet.connected, wallet.network, wallet.walletNetwork])
```

Both come from `connection.network`, so the comparison is `x !== x`. It is always
`false` until something calls `refreshWalletNetwork()` — and the app has to know
to do that, unprompted.

The comparison that actually matters is the **provider's** `network` (in scope at
`useWallet.ts:25`) against the wallet's real network. It is never made.

**`refreshWalletNetwork` is also Freighter-only.** `useWallet.ts:86` bails out for
every other wallet:

```ts
if (!wallet.connected || wallet.wallet !== "freighter") {
  return
}
```

and the network is then derived by a hardcoded passphrase comparison in a
Freighter-specific helper at `useWallet.ts:131-137` — even though every adapter
already implements `getNetworkDetails` (`wallets/types.ts:45`).

---

### Why this matters

The same dead check gates the pre-flight guard in the signing hooks:

`packages/core/src/hooks/useSendPayment.ts:61`

```ts
if (wallet.walletNetwork && wallet.network !== wallet.walletNetwork) {
```

and the equivalent line in `useAddTrustline.ts`. So a user whose Freighter is on
**mainnet** while the app's provider says `testnet` gets **no warning at any
layer** and signs a real-money transaction. This is the guard the README's
troubleshooting table promises exists.

---

### Where this lives

- Hook: `packages/core/src/hooks/useWallet.ts`
- Guarded call sites: `packages/core/src/hooks/useSendPayment.ts:61`,
  `packages/core/src/hooks/useAddTrustline.ts`
- Adapter interface: `packages/core/src/wallets/types.ts`
- Tests: `packages/core/src/hooks/useWallet.test.tsx`,
  `packages/core/src/hooks/useSendPayment.test.tsx`

---

### Implementation guidelines

- **Compare the context `network` against `wallet.walletNetwork`**, not
  `wallet.network` against itself. `network` is already destructured from
  `useStellarContext()` at `useWallet.ts:25`.
- On connect, set `walletNetwork` from what the **adapter reports**, not from the
  value the app asked for. `adapter.connect(network)` returns a `WalletConnection`
  which extends `WalletNetworkDetails` — it already carries the real
  `network` and `networkPassphrase` the extension is on. Keep `network` as the
  app-intent value and let `walletNetwork` be the observed one, then the two can
  legitimately differ.
- **Route `refreshWalletNetwork` through `adapter.getNetworkDetails()`** for every
  adapter. Delete the `wallet.wallet !== "freighter"` early return at line 86 and
  the bespoke `getFreighterNetwork` helper at `useWallet.ts:120-140`. The
  Freighter adapter already implements `getNetworkDetails`
  (`wallets/freighterAdapter.ts`) — use it.
- Make the signing hooks fail with a **typed** error. `useSendPayment.ts:62` throws
  a bare `new Error(…)` today, so `err.code` is `undefined`. Replace it with
  `createStellarError("WRONG_NETWORK", …)`; the code already exists in
  `errors/codes.ts:17`.
- Do not add auto-switching. Detect and report; switching networks is the user's
  decision inside their extension.

---

### Acceptance criteria

- [ ] Provider on `testnet` + wallet reporting `mainnet` → `isNetworkMismatch === true`
- [ ] Provider and wallet agreeing → `isNetworkMismatch === false`
- [ ] `useSendPayment().send()` under a mismatch rejects with a `StellarError`
      whose `code` is `WRONG_NETWORK`, **before** any transaction is built
- [ ] The same guard covers `useAddTrustline`
- [ ] `refreshWalletNetwork` works for every registered adapter, not just Freighter
- [ ] The bespoke `getFreighterNetwork` helper is gone; the adapter's
      `getNetworkDetails` is used instead
- [ ] Tests cover the mismatch path for at least two different adapters
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

- The dead guard: `packages/core/src/hooks/useWallet.ts:105-108`
- Where both fields get the same value: `packages/core/src/hooks/useWallet.ts:47-56`
- The adapter method that should be used: `packages/core/src/wallets/types.ts:45`
- Error code: `packages/core/src/errors/codes.ts:17` (`WRONG_NETWORK`)
- Related: `core-04` (wallet adapter error codes), `hook-use-wallet-autoconnect-and-adapters`
  (wallet change events)

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
