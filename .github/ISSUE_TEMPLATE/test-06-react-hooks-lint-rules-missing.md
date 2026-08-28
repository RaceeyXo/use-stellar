---
name: "Test 06: the React hooks lint rules are not installed"
about: A hooks library lints with no react-hooks plugin — exhaustive-deps would have caught the render loop
title: "fix(lint): enable eslint-plugin-react-hooks and lint the demo app"
labels: bug, testing, help wanted
---

## The React hooks lint rules are not installed

**Complexity:** Low (50 points)
**Estimated time:** 1 day

---

### Context

`.eslintrc.json` extends exactly two configs:

```json
"extends": [
  "eslint:recommended",
  "plugin:@typescript-eslint/recommended"
]
```

`eslint-plugin-react-hooks` is not in `extends`, not in `plugins`, and not in
`devDependencies`. This is a library whose entire public surface is React hooks,
and neither `react-hooks/rules-of-hooks` nor `react-hooks/exhaustive-deps` is
enabled.

`exhaustive-deps` is the rule that flags a `useEffect` or `useCallback` whose
dependency array does not match what the body actually closes over. That is the
exact failure mode behind several bugs already filed in this wave — `bug-01`'s
render loop is a dependency-array problem, and it is the kind of thing this rule
reports as a warning the moment you save the file.

There is a second, quieter gap in the same area. The root lint script is:

```json
"lint": "eslint packages/*/src/**/*.{ts,tsx} --max-warnings 0"
```

Every path is under `src/`. The demo app has no `src/` — its code lives in
`packages/demo/app/` and `packages/demo/components/`. **The entire demo application
is never linted**, which is why it can drift out of sync with the library's
conventions without anyone noticing.

---

### Why this matters

Static analysis catches dependency-array bugs for free, on every save, in every
editor, before a PR is ever opened. This wave adds seventeen new hooks written
largely by first-time contributors to the codebase. Turning the rule on before
they start is worth more than reviewing each one by hand afterwards.

Enabling it will produce a batch of warnings on existing code. That batch is a
useful map — several of those warnings are the bugs already filed here.

---

### Where this lives

- `package.json` (root — `devDependencies` and the `lint` script)
- `.eslintrc.json`
- `packages/demo/.eslintrc.json` — if the demo needs its own overrides

---

### Implementation guidelines

- **Add `eslint-plugin-react-hooks` to the root `devDependencies`** and enable both
  rules:

  ```json
  "plugins": ["@typescript-eslint", "react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
  ```

  `rules-of-hooks` as `error` — a violation is always a bug. `exhaustive-deps` as
  `warn` **for now**, because it has legitimate false positives and because
  `--max-warnings 0` in the lint script means a warning already fails the build.
  You get the enforcement without committing to the rule being infallible.

- **Do not blanket-suppress the results.** Run the lint, then triage:
  - A genuine bug → **do not fix it here.** Open an issue, or link to the existing
    one if it is already filed, and add a narrowly scoped
    `// eslint-disable-next-line react-hooks/exhaustive-deps` with a comment naming
    the issue number. Fixing a dependency array changes runtime behaviour, and that
    belongs in a PR reviewed for that behaviour — not in a lint-config PR.
  - A real false positive → suppress on that line with a one-line comment saying
    why.
  - Trivially correct → just add the missing dependency.

  A file-level or config-level disable is not acceptable. The PR should be readable
  as an inventory of what the rule found.

- **List every warning in the PR description,** grouped into those three buckets.
  That list is the most useful output of this issue — it tells the maintainers where
  the real dependency bugs are.

- **Fix the lint glob** so `packages/demo/app/` and `packages/demo/components/` are
  covered. Expect a wave of new findings from code that has never been linted. If
  the demo needs different rules — it is an application, not a library, and
  `no-console` may be reasonable there — give it its own `.eslintrc.json` rather
  than loosening the root config for everyone.

- **Raise the ESLint floor.** `devDependencies` declares `"eslint": "^8.0.0"`, but
  `@typescript-eslint` v8 supports `^8.57.0 || ^9.0.0`. The current range permits
  installs below the supported floor, which produces confusing plugin errors on a
  fresh clone. Tighten it to `^8.57.0`.

- Do not migrate to flat config (`eslint.config.js`) in this PR. It is a reasonable
  change, but bundling it here makes a small config PR into a large risky one. Open
  a follow-up issue.

---

### Acceptance criteria

- [ ] `eslint-plugin-react-hooks` is in `devDependencies` and enabled
- [ ] `react-hooks/rules-of-hooks` is `error`; `react-hooks/exhaustive-deps` is `warn`
- [ ] `pnpm lint` passes with `--max-warnings 0` still in place
- [ ] No file-level or config-level disable of either rule
- [ ] Every suppression is one line, scoped, and carries a reason or an issue number
- [ ] No dependency array is changed in this PR — findings are filed, not fixed
- [ ] The PR description inventories every warning as bug / false positive / trivial
- [ ] `packages/demo/app/` and `packages/demo/components/` are linted
- [ ] The ESLint version floor is raised to a version `@typescript-eslint` v8 supports
- [ ] No flat-config migration in this PR
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

- The config missing the plugin: `.eslintrc.json`
- The glob that skips the demo: root `package.json`, `scripts.lint`
- A dependency-array bug the rule would have caught: `bug-01`
- Related: `ci-01`, `test-05`, `repo-02`
- `exhaustive-deps`: https://react.dev/reference/react/useEffect#specifying-reactive-dependencies
- Plugin: https://www.npmjs.com/package/eslint-plugin-react-hooks

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
