---
name: "Pkg 01: the ESM entry point is typed as CommonJS"
about: The exports map points every types condition at one .d.ts, and nothing validates the published package
title: "fix(pkg): correct the exports map and validate it with publint and attw"
labels: bug, packaging, help wanted
---

## The ESM entry point is typed as CommonJS

**Complexity:** Medium (100 points)
**Estimated time:** 1 day

---

### Context

`packages/core/package.json` declares:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  }
}
```

One `types` entry serves both conditions. The package has no `"type": "module"`, so
a `.d.ts` file is interpreted by TypeScript as a **CommonJS** declaration — and it
is being offered as the types for the ESM entry point too.

Under `moduleResolution: "node16"`, `"nodenext"`, or `"bundler"` — the settings any
modern consumer uses — TypeScript resolves the `import` condition, finds a CJS
declaration file, and the module's shape is wrong: default-import interop differs,
and named exports may not resolve the way the runtime actually behaves. `attw` calls
this "Masquerading as CJS" and it is one of the most common ways a dual-format
package ships broken types.

tsup is configured with `dts: true` and both formats, so the build very likely
already emits a matching `index.d.mts` that nothing points at. Check `dist/` after
a build and confirm before you write the fix.

The `exports` map is also missing `"./package.json"`, which several tools resolve
directly and which a strict `exports` map otherwise blocks.

None of this is caught anywhere, because nothing lints the published package.

---

### Why this matters

Type errors from a bad `exports` map do not appear in this repository. They appear
in *consumers'* repositories, as confusing errors about a module having no default
export or no callable signature — and the consumer has no way to fix it. The
existing smoke test (`packages/core/scripts/smoke-test.js`) covers ESM import, CJS
require, and `tsc` resolution, but it runs `tsc` with `--moduleResolution node`, the
legacy algorithm, which does not consult `exports` at all. It cannot catch this.

---

### Where this lives

- `packages/core/package.json` (`exports`, and a lint script)
- `packages/core/tsup.config.ts` — only if the `.d.mts` is not being emitted
- `packages/core/scripts/smoke-test.js` (resolution mode)
- `.github/workflows/ci.yml`

---

### Implementation guidelines

- **Look at `dist/` first.** Run `pnpm build` and list what is actually emitted.
  Write the fix against that, not against what this issue predicts.
- **Split the types conditions:**

  ```json
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
    },
    "./package.json": "./package.json"
  }
  ```

  Condition order matters — `types` must come first within each branch, and
  `default` last. If tsup is not emitting `index.d.mts`, configure it to before
  changing the map; pointing at a file that does not exist is a worse failure than
  the one you started with.
- **Keep the top-level `main`, `module` and `types` fields.** They are the fallback
  for bundlers and toolchains that ignore `exports`. Removing them is a breaking
  change for older consumers and gains nothing.
- **Add the two tools that check this automatically:**
  - `publint` — validates the manifest and file layout
  - `@arethetypeswrong/cli` (`attw --pack .`) — resolves the package under every
    module mode and reports exactly this class of bug

  Wire both into a `lint:package` script and run it in CI after the build. These
  two commands are the durable part of this issue; the manifest edit is the easy
  part.
- **Fix the smoke test's resolution mode.** It currently runs
  `tsc --moduleResolution node`, which bypasses `exports` entirely. Add runs under
  `node16` and `bundler` so it exercises the map it is supposed to be validating.
- Do not change what is exported from `src/index.ts` — this issue is about how the
  built artifact is described, not about the public API.

---

### Acceptance criteria

- [ ] `pnpm build` output is inspected and the fix matches what is actually emitted
- [ ] The `import` and `require` conditions each carry their own `types`
- [ ] `"./package.json"` is exported
- [ ] `main`, `module` and `types` are still present
- [ ] `attw --pack .` reports no problems for CJS, ESM, `node16` and `bundler`
- [ ] `publint` passes
- [ ] Both run in CI after the build
- [ ] The smoke test additionally typechecks under `node16` and `bundler`
- [ ] `src/index.ts` is unchanged
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

- The exports map: `packages/core/package.json`
- The build that emits the declarations: `packages/core/tsup.config.ts`
- The smoke test using legacy resolution: `packages/core/scripts/smoke-test.js`
- Related: `ci-08` (runs the smoke test at release), `pkg-04` (build settings)
- `attw`: https://github.com/arethetypeswrong/arethetypeswrong.github.io
- `publint`: https://publint.dev
- Node conditional exports: https://nodejs.org/api/packages.html#conditional-exports

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
