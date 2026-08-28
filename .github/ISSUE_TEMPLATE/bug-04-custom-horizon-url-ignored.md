---
name: "Bug 04: Custom horizonUrl is validated then ignored"
about: Every Horizon hook hits the default SDF endpoint even when a custom node is configured
title: "fix(core): honour custom networkConfig.horizonUrl in every Horizon hook"
labels: bug, critical
---

## Honour custom `networkConfig.horizonUrl`

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

`StellarProvider` accepts a `networkConfig` prop so a developer can point the
library at their own Horizon node, a paid provider, or a local quickstart
container instead of the public SDF endpoint. The provider validates it carefully,
throws a descriptive error on a half-filled config, merges it into a
`NetworkConfig`, and stores it in context.

Then every Horizon-calling hook throws it away.

---

### The defect

`packages/core/src/utils/index.ts:16-18`

```ts
export function getHorizonServer(network: StellarNetwork): Horizon.Server {
  return new Horizon.Server(NETWORK_CONFIGS[network].horizonUrl)
}
```

The function takes the network **name** (`"testnet"` / `"mainnet"`) and looks the
URL up in the built-in `NETWORK_CONFIGS` table. The user's resolved
`networkConfig` never reaches it.

Every call site passes `network`, not `networkConfig`:

| File | Line |
|---|---|
| `hooks/useBalance.ts` | 66 |
| `hooks/useAccount.ts` | — `getHorizonServer(network)` |
| `hooks/useAsset.ts` | 64 |
| `hooks/useClaimableBalance.ts` | 43 |
| `hooks/usePayments.ts` | 58 |
| `hooks/useTransaction.ts` | 55 |
| `hooks/useTransactionHistory.ts` | 48 |
| `hooks/useSendPayment.ts` | 73 |
| `hooks/useAddTrustline.ts` | — build/submit path |
| `hooks/useAccountExists.ts` | — lookup path |

Grep for `getHorizonServer(` to get the authoritative list before you start.

Only `useSorobanContract` honours its override — it reads
`networkConfig.sorobanUrl` directly at `useSorobanContract.ts:82-84`.

---

### Why this matters

A developer who points `networkConfig` at their own node — usually to escape
public Horizon's rate limits — keeps hammering `horizon.stellar.org` and never
finds out. Nothing errors. Nothing warns. The app looks like it works.

This is the most misleading bug in the library: the provider goes out of its way
to validate the override, which is a strong signal to the developer that it is
being used.

---

### Where this lives

- Helper: `packages/core/src/utils/index.ts`
- All ten hook call sites under `packages/core/src/hooks/`
- Tests: the corresponding `*.test.ts` / `*.test.tsx` files
- Types: `packages/core/src/types/index.ts` (`NetworkConfig`)

---

### Implementation guidelines

- Change the signature to take the resolved config:

  ```ts
  export function getHorizonServer(config: NetworkConfig): Horizon.Server {
    return new Horizon.Server(config.horizonUrl, {
      allowHttp: config.horizonUrl.startsWith("http://"),
    })
  }
  ```

  The `allowHttp` flag matters for local quickstart nodes, which serve plain HTTP.
  `useSorobanContract.ts:83` already does exactly this — copy that pattern.
- Update every call site to destructure `networkConfig` from `useStellarContext()`
  and pass it. Several hooks currently destructure only `network`; some need
  **both** (`useSendPayment` passes `network` to the wallet adapter separately at
  `useSendPayment.ts:102`, and that must keep working).
- **Watch the dependency arrays.** Swapping a `network` string for a
  `networkConfig` object in a `useCallback` dependency list reintroduces `bug-01`'s
  identity churn. Depend on `networkConfig.horizonUrl` (a primitive), or land
  **`bug-02`** first so the object identity is stable. Prefer the primitive
  regardless.
- Keep `getNetworkConfig(network)` as-is — it is a separate helper with a
  different job and is exported for consumers.
- This is a wide but shallow change. Do all ten call sites in one PR; splitting it
  leaves the library in a half-fixed state that is worse than either end.

---

### Acceptance criteria

- [ ] `getHorizonServer` takes a `NetworkConfig`, not a network name
- [ ] `allowHttp` is enabled for `http://` URLs so local nodes work
- [ ] All call sites updated — `grep -r "getHorizonServer(" packages/core/src` shows
      no call passing a bare network name
- [ ] A test renders a hook under a provider with a custom `horizonUrl` and asserts
      `Horizon.Server` was constructed with **that** URL
- [ ] A test asserts the default (no override) path still uses the SDF testnet URL
- [ ] No hook's `useCallback` depends on the `networkConfig` object identity
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

- The helper: `packages/core/src/utils/index.ts:16-18`
- The validation that is currently pointless: `packages/core/src/context/StellarProvider.tsx:47-79`
- The one hook that gets it right: `packages/core/src/hooks/useSorobanContract.ts:82-84`
- Related: `core-03` (custom network passphrases) closes the other half of the
  custom-network story
- Horizon `Server` constructor: https://stellar.github.io/js-stellar-sdk/Horizon_Server.html

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
