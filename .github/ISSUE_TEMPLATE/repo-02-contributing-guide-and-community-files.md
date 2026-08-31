---
name: "Repo 02: CONTRIBUTING gives instructions that break the repo, and the community files are missing"
about: The setup section tells you to run npm install in a pnpm workspace, the clone command does not work, and there is no code of conduct, security policy or PR template
title: "docs(repo): fix CONTRIBUTING and add the missing community health files"
labels: documentation, chore, good first issue, help wanted
---

## CONTRIBUTING gives instructions that break the repo

**Complexity:** Low (50 points)
**Estimated time:** 1 day

---

### Context

`CONTRIBUTING.md` is the first file a contributor arriving through this wave will
read, and its setup section does not work.

**The clone command is a markdown link pasted into a shell block:**

```bash
git clone [https://github.com/YOUR_HANDLE/use-stellar](https://github.com/YOUR_HANDLE/use-stellar)
cd use-stellar
pnpm install
npm install
```

Copy that and `git clone` fails on the brackets.

**It then tells you to run `npm install` in a pnpm workspace.** That is not a
harmless extra step — `npm install` in a repo with `pnpm-workspace.yaml` writes a
`package-lock.json`, builds a flat `node_modules` that ignores the workspace
protocol, and leaves the tree in a state where `pnpm` and `npm` disagree about what
is installed. `packages/demo` depends on `"use-stellar": "workspace:*"`, which npm
cannot resolve at all.

**Every command afterwards is npm.** `npm run test`, `npm run test:package`,
`npm run dev` — in a project whose root `package.json` declares
`"packageManager": "pnpm@9.15.4"`, and whose "Code quality" section then switches
back to `pnpm format` / `pnpm lint` / `pnpm typecheck` in the very next block.

**And one claim is simply false:**

> Before every push — the SDK is built and all tests are run.

`.husky/pre-push` runs `format:check`, `lint`, `typecheck`, and a build. It does not
run tests. A contributor who trusts this pushes untested work — and since CI does
not run tests either (`ci-01`), nothing catches it.

Separately, the repository has no community health files at all: no
`CODE_OF_CONDUCT.md`, no `SECURITY.md`, no pull request template. `FUNDING.json`
and `.github/ISSUE_TEMPLATE/config.yml` exist, so the directory is in use — these
are just absent.

One more, worth a line: `.prettierignore` contains `*.md`, so `pnpm format:check`
skips every markdown file in the project. For a wave this documentation-heavy, that
means nothing checks the formatting of the thing most contributors are writing.

---

### Why this matters

A wave of first-time contributors will follow these instructions literally. The
`npm install` line will leave several of them with a broken workspace and no idea
why, and the answer — "the contributing guide is wrong" — is not one anyone reaches
on their own.

---

### Where this lives

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md` — new
- `SECURITY.md` — new
- `.github/PULL_REQUEST_TEMPLATE.md` — new
- `.editorconfig` — new
- `.prettierignore`

---

### Implementation guidelines

- **Fix the clone command** — a bare URL, no brackets.
- **Delete the `npm install` line.** `pnpm install` alone.
- **Convert every command to pnpm** and check each one exists in the relevant
  `package.json` before you write it down. Do not document a script that is not
  there.
- **Make the pre-push claim true.** Either describe what `.husky/pre-push` actually
  runs, or coordinate with `ci-01`, which is considering adding tests to it. Simply
  matching the documentation to the current hook is the safe choice here — say in
  the PR which you did.
- **Add `CODE_OF_CONDUCT.md`.** Contributor Covenant 2.1 is the standard choice.
  Fill in a real contact address — a placeholder makes the document worthless.
  Ask in the issue comments which address to use rather than guessing.
- **Add `SECURITY.md`.** This library builds and submits transactions that move
  money; it needs a stated private disclosure path. Cover supported versions, how to
  report, and expected response time. **Do not** invite vulnerability reports through
  public GitHub issues. Ask for the contact address in the comments, the same way.
- **Add `.github/PULL_REQUEST_TEMPLATE.md`,** matching the checklist the issue
  templates in this repository already use: what changed, `Closes #`, testnet only,
  local checks passing, and the `dev`-branch requirement. Keep it short — a long
  template gets deleted rather than filled in.
- **Add an `.editorconfig`** matching `.prettierrc`: 2 spaces, LF, UTF-8, final
  newline. This repository is developed on Windows, so line endings are worth being
  explicit about.
- **Remove `*.md` from `.prettierignore`,** then run `pnpm format` and commit the
  result. Expect a large diff of pure reformatting. **Put that reformatting in its
  own commit** so the substantive changes stay reviewable, and say so in the PR.
- **Verify the guide by following it.** Delete `node_modules`, clone fresh, and run
  every command in `CONTRIBUTING.md` in order. That is the only real test of this
  issue. Note in the PR that you did — and if a command fails for a reason outside
  this file's scope, file it (`pkg-05` covers the `pnpm dev` fresh-clone failure).
- Do not rewrite the whole guide. Fix what is wrong, add what is missing, leave the
  rest.

---

### Acceptance criteria

- [ ] The clone command works when copy-pasted
- [ ] `npm install` is gone; the guide is pnpm-only throughout
- [ ] Every documented command exists in the relevant `package.json`
- [ ] The pre-push description matches `.husky/pre-push`
- [ ] `CODE_OF_CONDUCT.md` exists with a real contact address
- [ ] `SECURITY.md` exists, states a private reporting path, and does not direct
      reports to public issues
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` exists and includes `Closes #`, testnet
      only, local checks, and the `dev`-branch requirement
- [ ] `.editorconfig` exists and agrees with `.prettierrc`
- [ ] `*.md` is removed from `.prettierignore` and `pnpm format:check` passes
- [ ] The markdown reformatting is an isolated commit
- [ ] Every command in `CONTRIBUTING.md` was run from a fresh clone — stated in the PR
- [ ] Contact addresses were confirmed in the issue comments, not invented
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

- The guide: `CONTRIBUTING.md`
- What pre-push actually runs: `.husky/pre-push`
- The declared package manager: root `package.json`, `packageManager`
- The markdown exclusion: `.prettierignore`
- An existing issue-template checklist to match: any `.github/ISSUE_TEMPLATE/*.md`
- Related: `ci-01` (pre-push and CI tests), `pkg-05` (the fresh-clone `pnpm dev`
  failure), `repo-01` (the wider cleanup)
- Contributor Covenant: https://www.contributor-covenant.org/version/2/1/code_of_conduct/
- Community health files: https://docs.github.com/en/communities

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
- **Ask in the comments for the contact addresses.** Do not invent one for a
  security policy.
- **Check the references above** before writing. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
