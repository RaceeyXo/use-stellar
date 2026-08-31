---
name: "CI 07: lockfile integrity is disabled in every workflow"
about: CI pins pnpm 8 against a pnpm 9 lockfile, so --frozen-lockfile had to be turned off — CI installs unpinned dependencies
title: "fix(ci): restore lockfile integrity — align the pnpm version and remove nested lockfiles"
labels: bug, ci, security, help wanted
---

## Lockfile integrity is disabled in every workflow

**Complexity:** Low (50 points)
**Estimated time:** Half a day to a day

---

### Context

Every install step in every workflow reads:

```yaml
run: pnpm install --frozen-lockfile=false
```

`--frozen-lockfile=false` tells pnpm to ignore the lockfile when it does not match
`package.json` and resolve fresh versions instead. It is the opposite of what CI
should do.

This is a symptom. Here is the chain:

1. Root `package.json` declares `"packageManager": "pnpm@9.15.4"`.
2. `pnpm-lock.yaml` is therefore `lockfileVersion: '9.0'` — check the first line.
3. Every workflow pins the _other_ major version:

   ```yaml
   - uses: pnpm/action-setup@v3
     with:
       version: 8
   ```

4. pnpm 8 cannot read a 9.0 lockfile. `--frozen-lockfile` fails.
5. So it was switched off, and CI has been resolving dependencies fresh ever since.

There is a second cause pulling in the same direction. This is a pnpm workspace
with `pnpm-workspace.yaml` at the root, but there are **three** lockfiles:

- `pnpm-lock.yaml` (correct)
- `packages/core/pnpm-lock.yaml` (should not exist)
- `packages/demo/pnpm-lock.yaml` (should not exist)

and a **nested workspace root**, `packages/demo/pnpm-workspace.yaml`, which declares
`packages: - 'packages/*'` inside a directory that contains no `packages/`. Because
pnpm resolves a workspace by walking up to the nearest `pnpm-workspace.yaml`, that
file makes `packages/demo` its own workspace root and detaches it from the monorepo.

---

### Why this matters

CI is not testing the dependency tree that contributors run, and — because
`release.yml` installs the same way — the published package is not built against a
pinned tree either. Every release resolves whatever is newest at build time.

That is a supply-chain exposure: a compromised or simply broken patch release of any
transitive dependency lands in a published artifact with no review and no way to
reproduce the build afterwards. It is also the mundane reason for "works on my
machine" CI failures, since the versions genuinely differ.

---

### Where this lives

- `.github/workflows/ci.yml`
- `.github/workflows/integration.yml`
- `.github/workflows/release.yml`
- `packages/core/pnpm-lock.yaml` — deleted
- `packages/demo/pnpm-lock.yaml` — deleted
- `packages/demo/pnpm-workspace.yaml` — deleted
- `.gitignore`

---

### Implementation guidelines

- **Stop pinning the pnpm version in the workflows.** Drop the `version:` input
  entirely — `pnpm/action-setup` reads the `packageManager` field from
  `package.json` when it is absent, so CI and contributors track one source of
  truth. If you prefer to be explicit, use `9` and keep it matching
  `packageManager`; do not leave two numbers that can drift.
- **Then remove `=false`.** Plain `pnpm install --frozen-lockfile`. In CI, an
  out-of-date lockfile _should_ fail the build — that is the signal that someone
  changed `package.json` without committing the lockfile.
- **Delete the nested lockfiles and the nested workspace file,** and add them to
  `.gitignore` so they do not come back:

  ```
  packages/*/pnpm-lock.yaml
  ```

- **Regenerate the root lockfile once** with the pinned pnpm version and commit it,
  so the frozen install has something correct to freeze against.
- **Verify by doing the thing CI does.** From a clean clone, with the pinned pnpm
  version, run `pnpm install --frozen-lockfile` and confirm it succeeds. Then run
  `pnpm build` and `pnpm test`. Report both in the PR — this issue is only closed
  when the frozen install genuinely works, not when the flag is removed.
- **Do not "fix" a frozen-install failure by editing the lockfile by hand.** If it
  fails, `package.json` and the lockfile genuinely disagree; run `pnpm install`
  normally, commit the result, and say what changed.
- Keep the scope here. Do not add caching strategies, matrices, or new jobs —
  `ci-01` owns the CI workflow's shape and `ci-08` owns the release workflow's
  contents.

---

### Acceptance criteria

- [ ] No workflow passes `--frozen-lockfile=false`
- [ ] The pnpm version used by CI matches `packageManager` in root `package.json`,
      with no second hardcoded number that can drift
- [ ] `packages/core/pnpm-lock.yaml`, `packages/demo/pnpm-lock.yaml` and
      `packages/demo/pnpm-workspace.yaml` are deleted
- [ ] `.gitignore` prevents nested lockfiles from returning
- [ ] The root lockfile is regenerated with the pinned version and committed
- [ ] `pnpm install --frozen-lockfile` succeeds from a clean clone — stated in the PR
- [ ] `pnpm build` and `pnpm test` pass after a frozen install — stated in the PR
- [ ] The duplicated double `pnpm install` in `release.yml` is reduced to one
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

- The three install steps: `.github/workflows/ci.yml`,
  `.github/workflows/integration.yml`, `.github/workflows/release.yml`
- The declared package manager: root `package.json`, `packageManager`
- The lockfile version: first line of `pnpm-lock.yaml`
- The nested workspace root: `packages/demo/pnpm-workspace.yaml`
- Related: `ci-01`, `ci-08`, `repo-01` (the wider cleanup)
- `pnpm/action-setup`: https://github.com/pnpm/action-setup
- Frozen lockfile: https://pnpm.io/cli/install#--frozen-lockfile

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
- **Follow existing conventions** — match the surrounding workflows.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
