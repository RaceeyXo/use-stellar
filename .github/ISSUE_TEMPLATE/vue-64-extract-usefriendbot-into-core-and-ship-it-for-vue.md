---
name: "Vue 64: Extract useFriendBot into core and ship it for Vue"
about: Move useFriendBot's logic out of the React hook into use-stellar/core, then add the Vue composable on top of it.
title: "feat(vue): extract useFriendBot into use-stellar/core and add the Vue composable"
labels: enhancement, vue, framework-agnostic, good first issue
---

## Extract useFriendBot into core and ship it for Vue

**Complexity:** Medium (100 points)
**Estimated time:** 1 day

---

### Context

`useFriendBot` (`packages/core/src/hooks/useFriendBot.ts`) — funding a testnet/futurenet account through Friendbot — keeps all of its logic inside the React hook: it imports nothing from `packages/core/src/queries` or `packages/core/src/actions`. That is why `@use-stellar/vue` cannot offer it: the Vue package may only build on the React-free `use-stellar/core` entry.

The hooks that were ported successfully (`usePayments`, `useSendPayment`, …) all went through this same split first: a plain action in core, a React hook and a Vue composable that are thin adapters over it.

---

### Why this matters

Until the logic is in core, the only way to give Vue users funding a testnet/futurenet account through Friendbot is to copy it into the Vue package — two implementations that drift apart, with different error codes and fee or validation behaviour. Extracting it also makes the React hook smaller and testable without React.

---

### Where this lives

- New: `packages/core/src/actions/friendbot.ts` (+ test)
- `packages/core/src/hooks/useFriendBot.ts` — becomes a thin adapter over the extracted action
- `packages/core/src/core.ts` — export the new module
- New: `packages/vue/src/useFriendBot.ts` and `packages/vue/src/useFriendBot.test.ts`
- `packages/vue/src/index.ts`
- Docs: `docs/vue/use-friend-bot.md`

---

### Implementation guidelines

- **Step 1 — extract.** Move the validation, transaction building, fee resolution, signing and submission into `packages/core/src/actions/friendbot.ts` as plain functions with no React import. Follow `packages/core/src/actions/sendPayment.ts`: take a runtime object (`network`, `networkConfig`, `wallet`, `queryStore`, `transactionTimeout`) and the call options.
- **Step 2 — slim the React hook.** `useFriendBot` keeps only React state and lifecycle and calls the extracted code. Its existing tests must pass **unchanged** — that is the proof behaviour did not move.
- Import cache helpers from their modules (`../cache/keys`, `../cache/store`), **not** the `../cache` index: the index re-exports the React `useQuery` and would put `react` back into the ESM `use-stellar/core` chunk.
- **Step 3 — the composable.** Copy `packages/vue/src/useSendPayment.ts`: `loading`/`error`/`result` refs, an operation id so a stale call cannot overwrite a newer one, `onlineManager` check, and `reset()`.
- Friendbot must refuse to run on mainnet with a typed error, exactly as the React hook does.

---

### Acceptance criteria

- [ ] `packages/core/src/actions/friendbot.ts` exists, has its own unit tests and imports nothing from React
- [ ] The existing `useFriendBot` React tests pass without modification
- [ ] `node -e "require('use-stellar/core')"` with React uninstalled still works (the Vue smoke test covers this)
- [ ] `useFriendBot` is exported from `@use-stellar/vue` and returns the same error codes as the React hook
- [ ] A rejected signature, a timeout (`TX_TIMEOUT` → `status: "pending"`) and a submission failure each leave the refs in the documented state
- [ ] Successful submission invalidates the affected account queries in the shared store
- [ ] `docs/vue/use-friend-bot.md` documents the composable
- [ ] Calling it on mainnet throws the same typed error as React
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

- React hook: `packages/core/src/hooks/useFriendBot.ts`
- Extraction precedent: `packages/core/src/actions/sendPayment.ts`
- Vue precedent: `packages/vue/src/useSendPayment.ts`
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
