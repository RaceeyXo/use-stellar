---
name: "CI 01: CI never runs the test suite"
about: ci.yml runs format, lint, typecheck and build — and no tests at all
title: "fix(ci): run the test suite in CI"
labels: bug, ci, help wanted
---

## CI never runs the test suite

**Complexity:** Low (50 points)
**Estimated time:** Half a day

---

### Context

`.github/workflows/ci.yml` has exactly two jobs:

- **`quality`** — `pnpm format:check`, `pnpm lint`, `pnpm typecheck`
- **`build`** — `pnpm build`

There is no `pnpm test` anywhere in the file.

The repository has roughly thirty test files under `packages/core/src`. Not one of
them runs on a push or a pull request. The only place tests execute is
`.github/workflows/release.yml`, which triggers on a `v*.*.*` tag — in other
words, tests run for the first time _while publishing to npm_.

`.husky/pre-push` does not cover the gap either. It runs `format:check`, `lint`,
`typecheck` and a build — no tests — despite `CONTRIBUTING.md` telling
contributors that "before every push — the SDK is built and all tests are run".

---

### Why this matters

Every issue in this wave asks contributors to add tests, and the acceptance
criteria say "`pnpm test` passes locally". Locally is currently the only place it
is ever checked. A PR that breaks twenty tests goes green, gets merged on a green
check, and the breakage is discovered at release time when the tag is already cut.

This is a fifteen-line change that determines whether the rest of the wave's test
coverage is worth anything.

---

### Where this lives

- `.github/workflows/ci.yml`
- `.husky/pre-push`
- `CONTRIBUTING.md` (the claim about pre-push running tests)

---

### Implementation guidelines

- **Add a `test` job** — or a `pnpm test` step in `quality`. A separate job is
  better: it runs in parallel and a lint failure no longer hides a test failure.
- **Make the job actually fail on a test failure.** Confirm this by pushing a
  deliberately broken test on your branch, watching CI go red, then reverting it.
  Say in the PR description that you did. A CI job that silently passes is worse
  than no job, and this repository already has one — see `test-02`.
- **Add `concurrency`** so a force-push cancels the superseded run:

  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```

  Without it, `on: [push, pull_request]` runs everything twice for every PR branch
  in this repo — the duplicate runs are visible in the Actions tab now.

- **Add an explicit `permissions:` block.** `contents: read` is all these jobs
  need; the default is broader.
- **Do not add the integration tests to this workflow.** They hit the live testnet
  and are currently broken in three separate ways — `test-02` deals with them.
  `pnpm test` already excludes them via `--testPathIgnorePatterns=integration`.
- **Drop `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true`** if the workflow still
  passes without it. Every action in the file is `@v4`/`@v3` and does not need the
  deprecated Node runtime this flag re-enables. Remove it, push, and check. If
  something does still need it, leave it and note which step in the PR.
- **Fix `.husky/pre-push` and `CONTRIBUTING.md` to agree with each other.** Either
  pre-push runs tests, or the documentation stops claiming it does. Adding
  `pnpm test` to pre-push is the better fix, but a long hook gets bypassed with
  `--no-verify`; if you add it, keep it to the unit suite only.

Do **not** change the pnpm version, the lockfile flags, or the release workflow
here. Those are `ci-07` and `ci-08`, and mixing them makes all three harder to
review.

---

### Acceptance criteria

- [ ] `pnpm test` runs on every push and every pull request
- [ ] A deliberately failing test turns the check red — demonstrated and stated in
      the PR description
- [ ] A `concurrency` group cancels superseded runs
- [ ] An explicit `permissions:` block is present and minimal
- [ ] Integration tests are **not** added to this workflow
- [ ] `.husky/pre-push` and `CONTRIBUTING.md` no longer contradict each other
- [ ] `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` is removed, or its necessity is
      explained in the PR
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

- The workflow missing its test step: `.github/workflows/ci.yml`
- Tests running only at release time: `.github/workflows/release.yml`
- The hook that does not run tests: `.husky/pre-push`
- The claim that it does: `CONTRIBUTING.md`, "Code quality"
- Related: `test-02` (integration tests), `ci-07` (lockfile), `ci-08` (release)
- GitHub Actions concurrency: https://docs.github.com/en/actions/using-jobs/using-concurrency

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
