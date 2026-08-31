---
name: "Docs 19: SSR and Next.js App Router guide"
about: The library throws errors telling users to move to a "use client" boundary, and there is no guide explaining any of it
title: "docs(guides): write the SSR and Next.js App Router guide"
labels: documentation, good first issue, help wanted
---

## SSR and Next.js App Router guide

**Complexity:** Medium (100 points)
**Estimated time:** 2 days

---

### Context

`docs/guides/` currently holds four guides: `typescript.md`, `networks.md`,
`wallets.md`, `error-handling.md`. There is no SSR guide — and SSR is the single
most common thing that goes wrong for a new user of this library.

The library already assumes the guide exists. Two hooks throw errors that
effectively cite it:

```ts
// packages/core/src/hooks/useWallet.ts:33-36
"Wallet connection is only available in the browser. " +
  'Move your component to a "use client" boundary in Next.js / Remix.'
```

```ts
// packages/core/src/hooks/useSendPayment.ts:55-56
"Transaction signing is only available in the browser. " +
  'Move your component to a "use client" boundary in Next.js / Remix.'
```

There is real SSR machinery behind this: an `isBrowser()` guard in `utils`, applied
across the hooks, plus two dedicated test suites —
`packages/core/src/__tests__/ssr.test.ts` (importing every hook in a Node
environment without crashing) and `ssr-guard.test.tsx`. All of that behaviour is
undocumented.

The demo app is a Next.js 14 App Router project, so a correct working example
already exists in `packages/demo/components/Providers.tsx` and the pages under
`packages/demo/app/`.

There is also an open UI issue, `ui-15-ssr-guide-docs-page`, to build the website
page for this guide. That issue needs content. This issue is the content.

---

### Why this matters

"I added `StellarProvider` to my Next.js app and got a hydration error" is the
first wall a new user hits, and the error messages send them somewhere that does
not exist. Everything needed to write the guide is already in the codebase; nobody
has written it down.

---

### Where this lives

- `docs/guides/ssr.md` — new
- `docs/getting-started/quickstart.md` — a link to the new guide
- `README.md` — a link, if the guide list is there

Do not change any source file. If you find a genuine SSR bug while writing this,
open a separate issue and link it.

---

### What the guide must cover

- **Why hooks cannot run on the server.** Wallets are browser extensions; there is
  no wallet, and no `window`, during a server render. Short and concrete — one
  paragraph, not a treatise.
- **Where `"use client"` goes.** On the component that uses the hooks, or on a
  wrapper around `StellarProvider`. Show the wrapper pattern from
  `packages/demo/components/Providers.tsx` — it is the pattern most readers should
  copy.
- **What `StellarProvider` does during a server render**, described from the actual
  code in `packages/core/src/context/StellarProvider.tsx`, not from assumption.
- **The two error messages, verbatim**, with what causes each and how to fix it. A
  reader who pastes one of those strings into a search box should land here.
- **Avoiding hydration mismatches.** Rendering `address` or `connected` directly in
  a server-rendered component produces markup that does not match the client.
  Show the correct pattern.
- **What is safe on the server.** Read-only Horizon calls are plain HTTPS requests
  and need no wallet. Be precise about which hooks are wallet-dependent and which
  are not — read the source rather than guessing.
- **A complete, copy-pasteable App Router example** — layout, provider wrapper, and
  one page using a hook.
- **A short Remix / Vite note.** The error messages mention Remix; do not leave it
  unaddressed. Two or three sentences is enough.

---

### Implementation guidelines

- **Follow `docs/example.md`.** It is the template every doc page in this repo uses.
  Match its heading structure and tone.
- **Every code sample must actually run.** Build the example in a scratch Next.js 14
  app, run it, and only then paste it in. Untested SSR examples are worse than no
  examples, because the failure mode they cause is a confusing hydration error.
- **Quote the error strings exactly** as they appear in the source, character for
  character. That is what makes the page findable.
- **Read the source before describing behaviour.** `isBrowser()` in
  `packages/core/src/utils/index.ts`, the guards in the hooks, and the two SSR test
  suites are the ground truth. If the README and the source disagree, the source
  wins — and mention the discrepancy in the PR.
- Keep it to **testnet** throughout.
- Note in the PR that `ui-15-ssr-guide-docs-page` can build against this file.

---

### Acceptance criteria

- [ ] `docs/guides/ssr.md` exists and follows `docs/example.md`
- [ ] Both error messages appear verbatim, with cause and fix
- [ ] The `"use client"` wrapper pattern is shown, based on the demo's `Providers.tsx`
- [ ] Hydration mismatch is explained with a correct and an incorrect example
- [ ] The guide states which hooks need a wallet and which do not, verified against
      the source
- [ ] A complete App Router example is included and **was actually run** — stated in
      the PR
- [ ] A short Remix / Vite note is included
- [ ] The quickstart links to the guide
- [ ] Every address is testnet
- [ ] No source file is changed
- [ ] `pnpm lint` and `pnpm typecheck` pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- Documentation template: [`docs/example.md`](../../docs/example.md)
- The first error message: `packages/core/src/hooks/useWallet.ts:33-36`
- The second: `packages/core/src/hooks/useSendPayment.ts:55-56`
- The guard: `packages/core/src/utils/index.ts` (`isBrowser`)
- The SSR tests: `packages/core/src/__tests__/ssr.test.ts`,
  `packages/core/src/__tests__/ssr-guard.test.tsx`
- A working App Router setup: `packages/demo/components/Providers.tsx`,
  `packages/demo/app/layout.tsx`
- Related: `bug-03` (`"use client"` in the package itself),
  `ui-15-ssr-guide-docs-page` (the website page for this content)
- Next.js client components: https://nextjs.org/docs/app/building-your-application/rendering/client-components

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
- **Follow existing conventions** — match the surrounding docs.
- **Use testnet only** in every example. Never hardcode a mainnet address.
- **Check the references above** before writing. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
