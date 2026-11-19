---
name: "Vue 48: Ship the useAccount composable"
about: Port useAccount to @use-stellar/vue on top of the shared runtime and query cache — the full account record (sequence, signers, thresholds, flags, subentries).
title: "feat(vue): ship the useAccount composable in @use-stellar/vue"
labels: enhancement, vue, framework-agnostic
---

## Ship the useAccount composable

**Complexity:** Medium (150 points)
**Estimated time:** 1 day
**Depends on:** `vue-45`

---

### Context

The React package has `useAccount` (`packages/core/src/hooks/useAccount.ts`) — the full account record (sequence, signers, thresholds, flags, subentries). `@use-stellar/vue` 0.2.3 does not export it: the shipped package has only `useBalance`, `useClaimableBalance`, `usePayments`, `usePaymentHistory`, `useSorobanContract`, `useContractEvents` and the three write composables.

The fetcher and query key already live in `packages/core/src/queries/account.ts` and are exported from `use-stellar/core`, so this is a thin composable.

---

### Why this matters

A Vue app that needs the full account record (sequence, signers, thresholds, flags, subentries) today has to call Horizon itself, outside the shared cache, so it gets none of the request deduplication, stale-time or error codes the rest of the package gives it — and two components asking for the same data make two requests.

---

### Where this lives

- New: `packages/vue/src/useAccount.ts` and `packages/vue/src/useAccount.test.ts`
- Export: `packages/vue/src/index.ts`
- Docs: `docs/vue/use-account.md`

---

### Implementation guidelines

- **Copy the shape of `packages/vue/src/useBalance.ts`.** Every option accepts a plain value, a ref or a getter (`MaybeRefOrGetter`), read with `toValue` inside `computed`.
- Read through the internal `useQuery` (`packages/vue/src/internal/useQuery.ts`) with `runtime.queryStore` and the **same query key the React hook uses**, so a Vue and a React reader of the same data would share one cache entry. Never keep a private cache.
- Call the core fetcher from `packages/core/src/queries/account.ts`. Do **not** reimplement Horizon calls or error mapping in the Vue package — if something the composable needs is only inside the React hook, move it into `packages/core/src/queries/account.ts` and make the React hook use it too.
- Default the address (where there is one) to `runtime.walletAddress`, as `useClaimableBalance` does.
- Return `ComputedRef`s, never writable refs the caller could corrupt, and a `refetch()`.
- Errors must be the typed `StellarError` from core with the same `code` the React hook produces.
- `useBalance` already reads the same `accountKey` — `useAccount` and `useBalance` on one address must share one request.

---

### Acceptance criteria

- [ ] `useAccount` is exported from `@use-stellar/vue` with its options and return types
- [ ] Changing a reactive option refetches; an option that resolves to `null`/empty disables the query without an error
- [ ] Two composables with the same arguments make **one** request (assert on the mocked SDK)
- [ ] Errors carry the same `code` as the React hook for 404, 429 and network failures
- [ ] Watchers stop when the effect scope is disposed (test with `createStellarTestHarness().dispose()`)
- [ ] Nothing is fetched during server rendering
- [ ] `docs/vue/use-account.md` documents options, return values and one example
- [ ] `useAccount` and `useBalance` on the same address make one request
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

- React hook: `packages/core/src/hooks/useAccount.ts`
- Core fetcher: `packages/core/src/queries/account.ts`
- Pattern to copy: `packages/vue/src/useBalance.ts`, `packages/vue/src/useClaimableBalance.ts`
- Test harness: `packages/vue/src/test-utils.ts`
- Vue `toValue`: https://vuejs.org/api/reactivity-utilities.html#tovalue

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
