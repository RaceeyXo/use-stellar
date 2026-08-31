---
name: "CI 08: the release workflow publishes unverified and interpolates the changelog into JavaScript"
about: No lint or typecheck before publish, no tag/version check, the packaging smoke test never runs, and the changelog is spliced into a script
title: "fix(ci): harden the release workflow"
labels: bug, ci, security, help wanted
---

## Harden the release workflow

**Complexity:** Medium (100 points)
**Estimated time:** 1 to 2 days

---

### Context

`.github/workflows/release.yml` fires on a `v*.*.*` tag and, in order: installs
twice, runs `pnpm test`, runs `pnpm build`, publishes to npm, extracts a changelog
section with `awk`, and creates a GitHub release. Five problems.

**1. The tag and the published version are never compared.** Nothing reads
`packages/core/package.json`. Tag `v0.2.0` while `version` still says `0.1.5` and
npm receives `0.1.5` — or rejects the publish as a duplicate — while the GitHub
release is titled `v0.2.0`. The two records disagree permanently and the tag cannot
be re-cut.

**2. The packaging smoke test never runs.** `packages/core/scripts/smoke-test.js`
already exists and is exactly the right check: it packs a tarball, installs it into
a scratch project, and verifies ESM `import`, CommonJS `require`, and `tsc` type
resolution all work. It is wired up as `pnpm test:package`. No workflow calls it.
The one script in the repo that would catch a broken `exports` map before it reaches
users is never executed.

**3. Lint and typecheck are skipped.** `pnpm test` runs; `pnpm lint` and
`pnpm typecheck` do not. A release can ship code that would fail the PR checks.

**4. The changelog is interpolated into a JavaScript program.**

```yaml
- name: Create GitHub Release
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.repos.createRelease({
        ...
        body: `${{ steps.changelog.outputs.notes }}`,
      });
```

`${{ }}` is substituted textually into the script _before_ it is parsed. A backtick
or a `${` anywhere in the changelog section terminates the template literal early —
at best a syntax error that fails the release, at worst arbitrary JavaScript running
in a job that holds `contents: write`. `CHANGELOG.md` is editable in any pull
request.

The `awk` step feeding it has the matching flaw: it writes to `$GITHUB_OUTPUT` using
a fixed `EOF` delimiter, so a changelog line consisting of `EOF` ends the value early
and lets the rest be parsed as further step outputs.

**5. No provenance, and broad permissions.** The job grants `contents: write` and
publishes without npm provenance, so there is no verifiable link between the
published tarball and the commit it came from.

---

### Why this matters

This is the last gate before code reaches users, and it is the weakest one in the
repository. It also runs against a dependency tree that was resolved fresh rather
than from the lockfile — see `ci-07`.

---

### Where this lives

- `.github/workflows/release.yml`

---

### Implementation guidelines

- **Assert the tag matches the version, first, before anything else runs.** Read
  `version` from `packages/core/package.json`, compare it to `${GITHUB_REF_NAME#v}`,
  and exit non-zero on a mismatch. Ten lines, and it makes an entire class of
  broken release impossible.
- **Run the full gate before publishing:** `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, then `pnpm test:package`. The smoke test must run
  **after** the build and **before** the publish — that ordering is the whole point.
- **Never interpolate `${{ }}` into a script body.** Pass the value through the
  environment and read it at runtime:

  ```yaml
  - uses: actions/github-script@v7
    env:
      RELEASE_NOTES: ${{ steps.changelog.outputs.notes }}
    with:
      script: |
        await github.rest.repos.createRelease({
          owner: context.repo.owner,
          repo: context.repo.repo,
          tag_name: process.env.GITHUB_REF_NAME,
          name: process.env.GITHUB_REF_NAME,
          body: process.env.RELEASE_NOTES,
        })
  ```

  `process.env` carries the value as data. It is never parsed as code.

- **Use a unique heredoc delimiter** for the `$GITHUB_OUTPUT` write, not a bare
  `EOF`. Generate one per run and use it as both the opening and closing marker.
- **Fail if the changelog section is empty.** A release whose notes silently came
  out blank means the `awk` pattern did not match the version — that is a bug worth
  stopping for, not shipping past.
- **Add npm provenance.** Add `id-token: write` to `permissions` and publish with
  provenance enabled. Keep `contents: write` — the release step needs it — but do
  not add anything broader.
- **Publish last.** Right now a failure in the changelog step happens _after_ the
  package is already on npm, which is unrecoverable: npm versions cannot be
  republished. Order every check before the publish and make the publish the final
  irreversible act.
- **Remove the duplicated `pnpm install`.** There are two consecutive install steps.
  (`ci-07` is fixing the flags; just delete the redundant line and coordinate if
  both PRs are open.)
- Consider guarding against prerelease tags (`v1.0.0-beta.1`) publishing to `latest`
  — either use the appropriate dist-tag or refuse the tag. Say which you chose.

---

### Acceptance criteria

- [ ] The workflow fails immediately when the git tag and `packages/core/package.json`
      version disagree
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm test:package`
      all run before the publish step
- [ ] `pnpm test:package` runs after the build and before the publish
- [ ] No `${{ }}` expression appears inside any `script:` body
- [ ] Release notes reach `github-script` through `env` / `process.env`
- [ ] The `$GITHUB_OUTPUT` heredoc uses a unique per-run delimiter
- [ ] An empty extracted changelog section fails the run
- [ ] `permissions` includes `id-token: write` and publishing uses provenance
- [ ] The npm publish is the last step in the job
- [ ] Only one `pnpm install` step remains
- [ ] Prerelease tag behaviour is decided and stated in the PR
- [ ] The workflow is validated on a throwaway tag in a fork, and the run is linked
      in the PR description
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

- The workflow: `.github/workflows/release.yml`
- The smoke test that never runs: `packages/core/scripts/smoke-test.js`,
  wired as `test:package` in `packages/core/package.json`
- The version that is never checked: `packages/core/package.json`
- Related: `ci-01`, `ci-07` (both touch install steps — coordinate),
  `pkg-01` (the `exports` map the smoke test validates)
- Script injection in Actions: https://securitylab.github.com/resources/github-actions-untrusted-input/
- npm provenance: https://docs.npmjs.com/generating-provenance-statements

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
- **Never commit a token or a secret.** Test in a fork with your own throwaway tag;
  do not add secrets to this repository.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
