---
name: "Bug 03: Package is unusable in the Next.js App Router"
about: Emit a "use client" banner so use-stellar can be imported from a Next.js app
title: "build: emit \"use client\" so the package works in the Next.js App Router"
labels: bug, critical, build, packaging
---

## Emit `"use client"` so the package works in the App Router

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

React Server Components draw a hard line between server and client modules. A
module that calls `createContext`, `useState`, or any other client-only React API
must be marked with the `"use client"` directive at the top of the file, or the
RSC compiler throws when a Server Component imports it.

`use-stellar` is a hooks library. Every export is client-only. But the built
bundle carries no directive, so importing it from an App Router page fails.

---

### The defect

`packages/core/tsup.config.ts` has no `banner`, and no source file carries the
directive:

```ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@stellar/stellar-sdk"],
})
```

Verified against a fresh build:

```
$ head -c 60 packages/core/dist/index.mjs
// src/context/StellarProvider.tsx
import * as React from "react";
```

And `packages/core/src/context/StellarProvider.tsx:39` calls `createContext(…)` at
module scope — the exact thing RSC rejects.

---

### Why this matters

Next.js is the stated target. The demo is a Next.js app and the README's first
example is `app/layout.tsx`. Importing `use-stellar` from a Server Component
throws today.

The demo only survives because `packages/demo/next.config.js` sets
`transpilePackages: ["use-stellar"]` **and** every demo page carries its own
`"use client"`. A real npm consumer has neither, so the very first thing they try
fails with an error that points at our package and gives them no way to fix it
from their side.

This also makes the README's SSR claim ("safe to import in server components")
false as written.

---

### Where this lives

- Build config: `packages/core/tsup.config.ts`
- Smoke test: `packages/core/scripts/smoke-test.js`
- Docs: `README.md` and `packages/core/README.md` (SSR section)

---

### Implementation guidelines

- Add a banner to `tsup.config.ts`:

  ```ts
  banner: { js: '"use client";' },
  ```

- **Verify both output formats.** tsup emits `dist/index.js` (CJS) and
  `dist/index.mjs` (ESM); the directive must be the first line of each. Check the
  built files directly, do not trust the config.
- The directive must come **before** any import statement. If tsup places the
  banner after the `// src/…` comment header that is fine; if it lands after an
  `import`, the directive is inert and the fix has not worked.
- Extend `packages/core/scripts/smoke-test.js` to assert the directive is present
  in the packed tarball's `dist/index.js` and `dist/index.mjs`. That script already
  packs and unpacks the tarball — add the assertion next to the existing ESM/CJS
  resolution checks.
- Update the SSR section of both READMEs so the claim matches reality once this
  lands. Say plainly: the package is a client library; import it from a
  `"use client"` boundary or from a component that is already client-side, and the
  directive is now emitted for you.
- Do **not** try to make the package server-safe. That is a separate, much larger
  design question (see `pkg-02`'s `react-server` condition).

---

### Acceptance criteria

- [ ] `dist/index.js` and `dist/index.mjs` both begin with `"use client"`
- [ ] `packages/core/scripts/smoke-test.js` asserts the directive is present in the
      **packed tarball**, not just the local `dist/`
- [ ] `pnpm test:package` passes
- [ ] The SSR section of `README.md` and `packages/core/README.md` matches reality
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

- Build config: `packages/core/tsup.config.ts`
- Smoke test to extend: `packages/core/scripts/smoke-test.js`
- The module-scope `createContext` call: `packages/core/src/context/StellarProvider.tsx:39`
- tsup `banner` option: https://tsup.egoist.dev/#inject-cjs-and-esm-shims
- Next.js `"use client"`: https://nextjs.org/docs/app/api-reference/directives/use-client

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
