---
name: "Vue 57: Extract useStreamPayments into core and ship it for Vue"
about: Move useStreamPayments's logic out of the React hook into use-stellar/core, then add the Vue composable on top of it.
title: "feat(vue): extract useStreamPayments into use-stellar/core and add the Vue composable"
labels: enhancement, vue, framework-agnostic
---

## Extract useStreamPayments into core and ship it for Vue

**Complexity:** Very High (300 points)
**Estimated time:** 3 to 4 days

---

### Context

`useStreamPayments` (`packages/core/src/hooks/useStreamPayments.ts`) — a live Horizon payment stream with reconnect — keeps all of its logic inside the React hook: it imports nothing from `packages/core/src/queries` or `packages/core/src/actions`. That is why `@use-stellar/vue` cannot offer it: the Vue package may only build on the React-free `use-stellar/core` entry.

The hooks that were ported successfully (`usePayments`, `useSendPayment`, …) all went through this same split first: a plain fetcher in core, a React hook and a Vue composable that are thin adapters over it.

---

### Why this matters

Until the logic is in core, the only way to give Vue users a live Horizon payment stream with reconnect is to copy it into the Vue package — two implementations that drift apart, with different error codes and fee or validation behaviour. Extracting it also makes the React hook smaller and testable without React.

---

### Where this lives

- New: `packages/core/src/queries/paymentStream.ts` (+ test)
- `packages/core/src/hooks/useStreamPayments.ts` — becomes a thin adapter over the extracted fetcher
- `packages/core/src/core.ts` — export the new module
- New: `packages/vue/src/useStreamPayments.ts` and `packages/vue/src/useStreamPayments.test.ts`
- `packages/vue/src/index.ts`
- Docs: `docs/vue/use-stream-payments.md`

---

### Implementation guidelines

- **Step 1 — extract.** Move the Horizon/RPC call, response mapping and error classification into `packages/core/src/queries/paymentStream.ts` as plain functions with no React import. Follow `packages/core/src/queries/account.ts`: a query key builder and a fetcher taking `networkConfig`.
- **Step 2 — slim the React hook.** `useStreamPayments` keeps only React state and lifecycle and calls the extracted code. Its existing tests must pass **unchanged** — that is the proof behaviour did not move.
- Import cache helpers from their modules (`../cache/keys`, `../cache/store`), **not** the `../cache` index: the index re-exports the React `useQuery` and would put `react` back into the ESM `use-stellar/core` chunk.
- **Step 3 — the composable.** Copy `packages/vue/src/useBalance.ts`: `MaybeRefOrGetter` options, the internal `useQuery` over `runtime.queryStore`, the same query key as React.
- The stream's reconnect and de-duplication rules (one live stream, late events from a closed stream ignored) are the hard part — move them into core with their tests (`useStreamPayments.reconnect.test.tsx`).
- The Vue composable closes the stream in `onScopeDispose` and reopens when the address changes.

---

### Acceptance criteria

- [ ] `packages/core/src/queries/paymentStream.ts` exists, has its own unit tests and imports nothing from React
- [ ] The existing `useStreamPayments` React tests pass without modification
- [ ] `node -e "require('use-stellar/core')"` with React uninstalled still works (the Vue smoke test covers this)
- [ ] `useStreamPayments` is exported from `@use-stellar/vue` and returns the same error codes as the React hook
- [ ] Two composables with the same arguments make one request
- [ ] Nothing is fetched during server rendering
- [ ] `docs/vue/use-stream-payments.md` documents the composable
- [ ] Changing the address closes the old stream before opening the new one
- [ ] No stream is opened during server rendering
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

- React hook: `packages/core/src/hooks/useStreamPayments.ts`
- Extraction precedent: `packages/core/src/queries/account.ts`, `packages/core/src/queries/payments.ts`
- Vue precedent: `packages/vue/src/useBalance.ts`
- Why the `../cache` index must not be imported: the 0.2.3 entry in `CHANGELOG.md`

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
