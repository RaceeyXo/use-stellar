---
name: "Pkg 04: the build emits untargeted output with broken source maps"
about: tsup has no target so it ships newer syntax than tsconfig validates, source maps are published without sources, and JSX uses the legacy runtime
title: "fix(pkg): pin the build target, fix source maps, and modernize the JSX transform"
labels: bug, packaging, help wanted
---

## The build emits untargeted output with broken source maps

**Complexity:** Medium (100 points)
**Estimated time:** 1 day

---

### Context

The whole build configuration is eight lines:

```ts
// packages/core/tsup.config.ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@stellar/stellar-sdk"],
})
```

Three problems follow from what is missing.

**No `target`.** esbuild defaults to `esnext` — it emits whatever syntax the source
used, downlevelling nothing. Meanwhile `packages/core/tsconfig.json` sets
`"target": "ES2020"`, so `pnpm typecheck` validates the code against ES2020 while
`pnpm build` publishes something that may not be. The two commands disagree about
what this package supports, and neither one is written down as the answer. There is
no `engines` field to settle it either.

**Source maps are published without sources.** `sourcemap: true` emits `.js.map`
files, and `"files": ["dist"]` ships them — but `src/` is not published. The maps
reference source paths that do not exist in the installed package, so a consumer
stepping into `use-stellar` in their debugger gets a broken map rather than no map.

**The JSX transform is the legacy one.** `tsconfig.json` sets `"jsx": "react"`,
which compiles JSX to `React.createElement` and requires `React` to be in scope.
`StellarProvider.tsx` accommodates this with `import * as React from "react"` at
line 1 — so it works, but every consumer's bundle carries the namespace import, and
the file cannot drop it. `"react-jsx"` is the modern automatic runtime and has been
the default for new React projects since React 17.

The tsconfig also sets `"module": "commonjs"` while the build emits both CJS and
ESM, which is a further disagreement between what is typechecked and what is
shipped.

Related: `packages/core/tsup.config.bundled_rpqjbzu1vlq.mjs` is a tsup temporary
artifact that has been committed to the repository. `repo-01` removes it.

---

### Why this matters

None of these break the package today, which is exactly why they persist. What they
do is make the package's actual support surface unknowable — nobody can say which
Node versions or browsers this library supports, because no file states it and the
two tools that could enforce it disagree.

The source maps are the sharpest of the three: shipping a broken map is worse than
shipping none, because the debugger trusts it.

---

### Where this lives

- `packages/core/tsup.config.ts`
- `packages/core/tsconfig.json`
- `packages/core/package.json` (`engines`)
- `packages/core/src/context/StellarProvider.tsx` — only the React import, if the
  transform changes

---

### Implementation guidelines

- **Decide the support floor, then make everything say it.** Node 20 is what CI and
  `CONTRIBUTING.md` already assume; `es2020` is a defensible browser floor and
  matches the current tsconfig. Whatever you pick:
  - set `target` in `tsup.config.ts`
  - keep `target` in `tsconfig.json` matching it
  - add an `engines.node` field to `packages/core/package.json`
  - state the floor in the PR description

  The specific values matter less than the three of them agreeing.
- **Fix the source maps — decide, do not split the difference.** Either publish
  `src/` by adding it to `files` so the maps resolve, or set `sourcemap: false` and
  ship none. For a library this size, publishing `src` is the friendlier option and
  costs little; a broken map is the one outcome to avoid.
- **Move to `"jsx": "react-jsx"`.** Then remove the now-unnecessary
  `import * as React from "react"` from `StellarProvider.tsx` — but only if nothing
  else in the file uses the `React` namespace. Check before deleting.
- **Set `"module"` in tsconfig to something consistent with a dual-format build** —
  `esnext` with `"moduleResolution": "bundler"` is the usual pairing, since tsup
  handles the actual emit. Verify `pnpm typecheck` still passes; this change can
  surface real import-shape errors, and if it does, fix them rather than reverting.
- **Enable `treeshake: true`** in tsup and record the size difference in the PR.
- **Do not add a `banner` for `"use client"` in this PR.** `bug-03` owns the
  directive question, including whether esbuild is stripping it. If you discover
  something about how the bundler handles it, add it as a comment on `bug-03`.
- **Verify the output, do not assume it.** After building, check that the emitted
  syntax matches the target, that a map resolves to a real file, and that
  `pnpm test:package` still passes. Note in the PR what you checked.

---

### Acceptance criteria

- [ ] `tsup` has an explicit `target`
- [ ] The tsup target, the tsconfig target, and a new `engines.node` field agree
- [ ] The support floor is stated in the PR description
- [ ] Source maps either resolve to published sources, or are not emitted
- [ ] `"jsx": "react-jsx"` is set and the build passes
- [ ] The `React` namespace import is removed if it is no longer needed
- [ ] `tsconfig` `module` / `moduleResolution` are consistent with a dual build, and
      `pnpm typecheck` passes without reverting the change
- [ ] `treeshake` is enabled and the size difference is in the PR
- [ ] No `"use client"` banner is added here
- [ ] `pnpm test:package` passes
- [ ] The demo app still builds
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
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

- The build config: `packages/core/tsup.config.ts`
- The disagreeing compiler options: `packages/core/tsconfig.json`
- The namespace import the legacy transform requires:
  `packages/core/src/context/StellarProvider.tsx:1`
- The committed build artifact: `packages/core/tsup.config.bundled_rpqjbzu1vlq.mjs`
- Related: `bug-03` (`"use client"`), `pkg-01` (declarations), `pkg-03` (size),
  `repo-01` (removes the stray artifact)
- esbuild targets: https://esbuild.github.io/api/#target
- The JSX transform: https://react.dev/blog/2020/09/22/introducing-the-new-jsx-transform

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
