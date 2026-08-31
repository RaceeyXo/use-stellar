---
name: "Pkg 05: the demo app is never built, typechecked, or linted"
about: pnpm build only builds the library, the demo has no lint or typecheck scripts, and pnpm dev fails on a fresh clone
title: "fix(pkg): build, typecheck and lint the demo app — and make pnpm dev work on a fresh clone"
labels: bug, packaging, ci, help wanted
---

## The demo app is never built, typechecked, or linted

**Complexity:** Low (50 points)
**Estimated time:** 1 day

---

### Context

`packages/demo` is a Next.js 14 App Router application with ten demo pages. Nothing
in the repository verifies it.

**It is never built.** The root `build` script is:

```json
"build": "pnpm --filter use-stellar build"
```

Only the library. `ci.yml`'s build job runs `pnpm build`, so `next build` never runs
in CI.

**It is never typechecked.** The root `typecheck` script is
`tsc --noEmit -p packages/core/tsconfig.json` — the core package only, despite
`packages/demo/tsconfig.json` existing.

**It is never linted.** The root lint glob is `packages/*/src/**/*.{ts,tsx}`, and the
demo has no `src/` — its code lives in `packages/demo/app/` and
`packages/demo/components/`. (`test-06` also covers this glob; coordinate.)

**Its own package.json has no scripts for either.** Only `dev`, `build`, `start`.

The consequence is already in the git history: commit `c5f3d3c`,
_"fix(demo): resolve build errors"_. The demo broke, stayed broken, and was found
by hand.

There is a related first-run problem. The root `dev` script goes straight to the
demo:

```json
"dev": "pnpm --filter @use-stellar/demo dev"
```

The demo depends on `"use-stellar": "workspace:*"`, and pnpm links that to
`packages/core`, whose `main` and `exports` point into `dist/`. On a fresh clone
`dist/` does not exist, so `pnpm install && pnpm dev` — which is what
`CONTRIBUTING.md` tells a new contributor to run — fails to resolve `use-stellar`
until someone works out that `pnpm build` has to run first.

---

### Why this matters

The demo is the first thing a new contributor runs and the main showcase for the
library. It is also the only place the hooks are exercised as a real consumer would
exercise them — through the built package, in a Next.js App Router app, with SSR.
That makes it the only end-to-end check the project has, and it is unwired.

The fresh-clone failure is worse than it sounds: it hits every new contributor in
their first ten minutes, before they have any context to debug it with.

---

### Where this lives

- `package.json` (root — `build`, `dev`, `typecheck`, `lint` scripts)
- `packages/demo/package.json` (scripts)
- `packages/demo/.eslintrc.json` — new, if the demo needs its own rules
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md` — if the documented commands change

---

### Implementation guidelines

- **Make the root `build` build both packages, in order.** The library first, the
  demo second — the demo consumes the library's `dist/`. Keep a `build:lib` script
  for the library alone; `ci-08`'s release workflow should keep publishing from a
  library-only build rather than depending on `next build` succeeding.
- **Make `pnpm dev` work from a fresh clone** by building the library first. A
  `predev` script, or `pnpm build:lib && pnpm --filter @use-stellar/demo dev`, both
  work. Verify it for real: delete `node_modules` and `packages/core/dist`, run
  `pnpm install && pnpm dev`, and confirm the demo comes up. Say in the PR that you
  did — this is the acceptance criterion that matters most here.
- **Add `typecheck` and `lint` scripts to `packages/demo`** and have the root
  scripts run both packages. `next lint` is the conventional choice for the demo.
- **Expect the demo to be broken.** Nothing has checked it since the last manual
  fix. Fix what you find — that is the work of this issue, not a distraction from
  it. If a failure turns out to be a genuine library bug rather than a demo bug,
  stop, open a separate issue, and link it rather than patching around it in the
  demo.
- **Give the demo its own ESLint config if it needs one.** It is an application, not
  a library: `no-console` and some of the stricter type rules may reasonably differ.
  Do not loosen the root config for everyone to make the demo pass.
- **Add the demo build to CI.** A separate job is fine, and it should run after the
  library build.
- Do not touch `packages/demo/pnpm-workspace.yaml` or the nested lockfile — `ci-07`
  is removing both. If `ci-07` has not landed yet and the nested workspace file
  blocks you, say so in the issue comments rather than deleting it here.

---

### Acceptance criteria

- [ ] `pnpm build` builds the library and then the demo
- [ ] A `build:lib` script still builds the library alone
- [ ] From a clean clone with no `dist/`, `pnpm install && pnpm dev` starts the demo
      — demonstrated and stated in the PR
- [ ] `pnpm typecheck` covers `packages/demo`
- [ ] `pnpm lint` covers `packages/demo/app` and `packages/demo/components`
- [ ] Every error surfaced by the above is fixed, or filed as a linked library issue
- [ ] The demo has its own ESLint config if its rules differ; the root config is not
      loosened
- [ ] CI builds the demo
- [ ] `CONTRIBUTING.md` matches the commands that now exist
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] Every example uses **testnet only** — no mainnet addresses
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- The library-only scripts: root `package.json`
- The demo's three scripts: `packages/demo/package.json`
- The workspace link that needs `dist/`: `packages/demo/package.json`, `dependencies`
- The build job: `.github/workflows/ci.yml`
- Evidence of the problem: commit `c5f3d3c`, _"fix(demo): resolve build errors"_
- Related: `ci-01`, `ci-07` (nested workspace file), `ci-08` (release build),
  `test-06` (the lint glob)

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
