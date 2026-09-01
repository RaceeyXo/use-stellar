---
name: "Pkg 02: wallet SDKs are bundled into dist and installed as dependencies"
about: Every consumer downloads three wallet SDKs, one of which is never imported, and gets two copies of the other two
title: "fix(pkg): externalize the wallet SDKs and drop the unused dependency"
labels: bug, packaging, help wanted
---

## Wallet SDKs are shipped twice, and one is never used at all

**Complexity:** Medium (100 points)
**Estimated time:** 1 to 2 days

---

### Context

`packages/core/package.json` declares four runtime dependencies:

```json
"dependencies": {
  "@albedo-link/intent": "^0.13.0",
  "@lobstrco/signer-extension-api": "2.0.0",
  "@stellar/freighter-api": "6.0.1",
  "@stellar/stellar-sdk": "^12.0.0"
}
```

`tsup.config.ts` externalizes three modules:

```ts
external: ["react", "react-dom", "@stellar/stellar-sdk"]
```

Compare the two lists. `@stellar/freighter-api`, `@albedo-link/intent` and
`@lobstrco/signer-extension-api` are **not** external, so esbuild inlines them into
`dist/index.js` and `dist/index.mjs`. They are also declared as `dependencies`, so
npm installs them into `node_modules` as well. Every consumer gets both copies.

`@lobstrco/signer-extension-api` is worse than duplicated — it is **never imported
anywhere in `src/`**. The only mention of LOBSTR in the codebase is
`registry.ts:38`:

```ts
lobstr: createUnsupportedAdapter("lobstr", "LOBSTR"),
```

A pinned dependency, downloaded by every consumer of this library, backing a wallet
that is explicitly unsupported.

There is a knock-on effect inside `useWallet`. It dynamically imports Freighter with
an explicit comment about why:

```ts
// packages/core/src/hooks/useWallet.ts:121-122
// Dynamic import keeps @stellar/freighter-api out of the SSR bundle.
const freighter = await import("@stellar/freighter-api")
```

That works only if the module stays a separate module. Bundled and inlined by
esbuild, the dynamic import no longer defers anything meaningful — the code is
already in the file. Confirm this against a real build before you write the fix.

Finally, the monorepo root `package.json` declares its own runtime dependency on
`@albedo-link/intent`. The root is `"private": true` and ships nothing; that entry
is duplication with nothing to install it for.

---

### Why this matters

This is the install size and the bundle size of every application that depends on
`use-stellar`. A React app that only ever uses Albedo still downloads and bundles
Freighter's SDK and LOBSTR's, and it cannot dedupe or override either, because they
are welded into the build output.

It also removes a consumer's ability to control the wallet SDK version — a security
fix in Freighter's API cannot be applied by the application; it needs a release of
this library.

---

### Where this lives

- `packages/core/tsup.config.ts`
- `packages/core/package.json`
- `package.json` (root)
- `packages/core/src/wallets/registry.ts` — only if the LOBSTR stub needs adjusting
- `docs/getting-started/installation.md`, `docs/guides/wallets.md`

---

### Implementation guidelines

- **Measure first.** Build on `dev`, record the byte size of `dist/index.mjs`, and
  grep the output for a string unique to each wallet SDK to confirm what is actually
  inlined. Put the before/after numbers in the PR — that is the evidence this issue
  turns on.
- **Externalize every wallet SDK** in `tsup.config.ts`, alongside
  `@stellar/stellar-sdk`.
- **Make them optional peer dependencies:**

  ```json
  "peerDependencies": {
    "@albedo-link/intent": "^0.13.0",
    "@stellar/freighter-api": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "@albedo-link/intent": { "optional": true },
    "@stellar/freighter-api": { "optional": true }
  }
  ```

  Optional is the important word: a consumer who only uses Freighter installs only
  Freighter, and gets no warning about the other.

- **This is a breaking change for consumers, and the code must handle it.** With the
  SDK optional, `await import("@albedo-link/intent")` can now reject with a module
  resolution error. Each adapter must catch that and surface
  `WalletAdapterError("wallet_unavailable", ...)` with a message naming the package
  to install — not an unhandled rejection and not a raw bundler error. Coordinate
  with `core-04`, which is mapping adapter errors.
- **Remove `@lobstrco/signer-extension-api` entirely.** Nothing imports it. When a
  real LOBSTR adapter is written it can be added back as an optional peer, the same
  as the others. Leave `registry.ts:38` as it is — the stub is correct behaviour and
  is `hook-use-wallet-autoconnect-and-adapters`'s territory.
- **Remove the `dependencies` block from the root `package.json`.** The root is
  private and builds nothing.
- **Verify the dynamic import still defers.** After externalizing, check that
  `@stellar/freighter-api` appears as a real import in the output rather than an
  inlined chunk, so the comment at `useWallet.ts:121` is true again.
- **Update the install docs.** A consumer reading `docs/getting-started/installation.md`
  must be told which wallet package to install alongside. An optional peer
  dependency that is undocumented is just a runtime crash with extra steps.
- Add a `CHANGELOG.md` entry marking this as breaking.

---

### Acceptance criteria

- [ ] Before/after `dist/index.mjs` sizes are in the PR description
- [ ] No wallet SDK is inlined into `dist` — verified by grepping the build output
- [ ] `@stellar/freighter-api` and `@albedo-link/intent` are optional peer
      dependencies, not dependencies
- [ ] `@lobstrco/signer-extension-api` is removed
- [ ] The root `package.json` has no `dependencies` block
- [ ] A missing optional peer produces `wallet_unavailable` with a message naming the
      package to install — proven by a test
- [ ] The Freighter dynamic import survives as a real deferred import
- [ ] `docs/getting-started/installation.md` and `docs/guides/wallets.md` list the
      optional packages
- [ ] `CHANGELOG.md` records the breaking change
- [ ] `pnpm test:package` still passes
- [ ] The demo app still builds and connects
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

- The externals list: `packages/core/tsup.config.ts`
- The dependencies: `packages/core/package.json`
- The unused LOBSTR dependency's only mention: `packages/core/src/wallets/registry.ts:38`
- The dynamic import this affects: `packages/core/src/hooks/useWallet.ts:121-122`
- The root runtime dependency: root `package.json`
- Related: `pkg-03` (the size budget this changes), `core-04` (adapter errors),
  `hook-use-wallet-autoconnect-and-adapters`
- Optional peers: https://nodejs.org/api/packages.html#peerdependenciesmeta

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
- **Follow existing conventions** — match the surrounding config.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
