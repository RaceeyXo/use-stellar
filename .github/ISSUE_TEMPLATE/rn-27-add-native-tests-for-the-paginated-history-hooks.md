---
name: "React Native 27: Add native tests for the paginated history hooks"
about: usePayments, usePaymentHistory, useTransactionHistory, useTrades have no React Native tests; prove they work on the native provider.
title: "test(react-native): cover usePayments, usePaymentHistory, useTransactionHistory, useTrades on the native provider"
labels: enhancement, react-native, framework-agnostic, testing
---

## Add native tests for the paginated history hooks

**Complexity:** High (200 points)
**Estimated time:** 2 days

---

### Context

`packages/react-native/src/__tests__` has a `*.native.test.tsx` for the account, asset, balance, claimable-balance, contract-events, federation, network, payment-paths, Soroban-read and transaction hooks. `usePayments`, `usePaymentHistory`, `useTransactionHistory`, `useTrades` have none, so nothing checks them against the native `StellarProvider` (AppState focus, NetInfo online state, AsyncStorage session, Hermes-style globals).

---

### Why this matters

`@use-stellar/react-native` re-exports every hook from `use-stellar` and its README says they all work on native. Untested hooks are where a web-only API (`window`, `document`, `EventSource`, `localStorage`) slips in unnoticed.

---

### Where this lives

- New: `packages/react-native/src/__tests__/usePayments.native.test.tsx`
- New: `packages/react-native/src/__tests__/usePaymentHistory.native.test.tsx`
- New: `packages/react-native/src/__tests__/useTransactionHistory.native.test.tsx`
- New: `packages/react-native/src/__tests__/useTrades.native.test.tsx`
- `packages/react-native/src/test-utils/**` (only if a mock is missing)

---

### Implementation guidelines

- Copy `useBalance.native.test.tsx`: render through the RN test harness (`src/test-utils/render.tsx`), mock the SDK, never hit the network.
- For each hook test: initial load, refetch when the app returns to the foreground (AppState mock), pause while offline (NetInfo mock), and error codes.
- Drive `fetchNext` the way a `FlatList` `onEndReached` would, including two calls in quick succession, which must not load the same page twice.
- If a hook fails on native, open a separate bug with the failure — do not patch the hook inside this test PR.

---

### Acceptance criteria

- [ ] `usePayments` has a native test file covering load, foreground refetch, offline and error codes
- [ ] `usePaymentHistory` has a native test file covering load, foreground refetch, offline and error codes
- [ ] `useTransactionHistory` has a native test file covering load, foreground refetch, offline and error codes
- [ ] `useTrades` has a native test file covering load, foreground refetch, offline and error codes
- [ ] `no-live-calls.test.tsx` still passes (no real network)
- [ ] Rapid `fetchNext` calls never duplicate or skip records
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

- Pattern: `packages/react-native/src/__tests__/useBalance.native.test.tsx`
- Harness: `packages/react-native/TEST-UTILS.md`
- Hook: `packages/core/src/hooks/usePayments.ts`
- Hook: `packages/core/src/hooks/usePaymentHistory.ts`
- Hook: `packages/core/src/hooks/useTransactionHistory.ts`
- Hook: `packages/core/src/hooks/useTrades.ts`

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
- **Follow existing conventions** — match the surrounding code.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
