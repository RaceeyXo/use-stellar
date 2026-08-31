---
name: "Repo 01: build artifacts, dev logs and a mistyped shell command are committed"
about: A file literally named "et --hard HEAD@{5}" is tracked, along with logs, a typo'd CLAUDE file, and a tsup temp artifact
title: "chore(repo): remove committed junk files and fix .gitignore"
labels: chore, good first issue, help wanted
---

## Build artifacts, dev logs and a mistyped shell command are committed

**Complexity:** Low (50 points)
**Estimated time:** Half a day

---

### Context

`git ls-tree -r origin/dev` shows the following tracked at the repository root or
inside `packages/core`:

| File                                                | What it is                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `et --hard HEAD@{5}`                                | A file created by a mistyped `git reset --hard HEAD@{5}` — the shell wrote the truncated command to disk as a filename, and it was committed |
| `CLUADE.MD`                                         | A misspelling of `CLAUDE.md`. `.gitignore` lists `.CLUADE.MD` — with a leading dot — so the pattern does not match the tracked file          |
| `demo-dev.log`, `demo-dev.err.log`                  | Next.js dev server logs                                                                                                                      |
| `commit.ps1`, `install.cmd`                         | Personal helper scripts, Windows-specific                                                                                                    |
| `CI-VERIFICATION-REPORT.md`                         | One-off working notes                                                                                                                        |
| `WALLET-NETWORK-SYNC-IMPLEMENTATION.md`             | One-off working notes                                                                                                                        |
| `packages/core/tsup.config.bundled_rpqjbzu1vlq.mjs` | A tsup temporary build artifact with a random suffix                                                                                         |
| `Figma/*.txt` (six files)                           | Raw design-tool text dumps                                                                                                                   |

`.gitignore` in full is:

```
node_modules/
dist/
.env
.env.local
*.tsbuildinfo
coverage/
.CLUADE.MD
```

No `*.log`, no OS files, nothing for tsup's temporary artifacts, and — as noted —
the one bespoke entry has a typo that stops it matching.

There is one more gap worth closing. `packages/core/scripts/smoke-test.js` creates
`packages/core/smoke-test-fixture/` and `use-stellar-<version>.tgz` while it runs.
It cleans up on success and on a handled failure, but a crash or a Ctrl-C leaves
both behind, and neither is ignored — so the next `git status` invites someone to
commit a tarball.

---

### Why this matters

This is the first thing anyone sees when they clone the repository, and it is the
first impression for every contributor arriving through this wave. A root directory
containing `et --hard HEAD@{5}` alongside two stray log files says something about
the project that the code does not deserve.

It is also a live hazard: `.gitignore` not covering `*.log` means the next person
who runs the dev server and types `git add .` commits their logs too.

---

### Where this lives

- `.gitignore`
- The files listed in the table above
- `.prettierignore` — only if a removed path is referenced there

---

### Implementation guidelines

- **Ask before deleting the two working-note files.** `CI-VERIFICATION-REPORT.md`
  and `WALLET-NETWORK-SYNC-IMPLEMENTATION.md` may hold information the maintainers
  still want. Post in the issue comments proposing to move them under `docs/` or
  delete them, and wait for an answer. Everything else in the table is unambiguous.
- **Ask about `Figma/` too.** Six design dumps supporting the `ui-*` issues — they
  may be deliberate. Propose moving them under `docs/design/` rather than deleting,
  and let a maintainer decide.
- **`CLUADE.MD`:** check whether the content is meant to be the project's
  `CLAUDE.md`. If so, rename it correctly rather than deleting it, and fix the
  `.gitignore` entry to match whatever the decision is.
- **Delete outright:** `et --hard HEAD@{5}`, `demo-dev.log`, `demo-dev.err.log`,
  `packages/core/tsup.config.bundled_rpqjbzu1vlq.mjs`.
  - The odd filename contains spaces, braces and `@` — quote it:
    `git rm "et --hard HEAD@{5}"`.
- **`commit.ps1` and `install.cmd`:** read them first. If either encodes a real
  workflow the project depends on, say so and propose a home for it (a `scripts/`
  directory, or documentation in `CONTRIBUTING.md`). If they are personal shortcuts,
  delete them.
- **Extend `.gitignore`** to cover at least: `*.log`, `.DS_Store`, `Thumbs.db`,
  `*.bundled_*.mjs`, `packages/core/smoke-test-fixture/`, `*.tgz`, and `.idea/`.
  Do **not** add `packages/*/pnpm-lock.yaml` here — `ci-07` owns that, along with
  deleting the nested lockfiles themselves. Coordinate rather than racing it.
- **Confirm nothing depended on what you removed.** Grep for each filename across
  the repo — workflows, scripts, docs — before deleting. Run `pnpm install`,
  `pnpm build`, `pnpm test` and `pnpm test:package` afterwards and confirm all four
  still pass.
- Keep this a **deletion-and-ignore PR**. Do not reformat, rename source files, or
  fix anything else you notice along the way. Reviewing a cleanup is only easy while
  it stays a cleanup.

---

### Acceptance criteria

- [ ] `et --hard HEAD@{5}`, `demo-dev.log`, `demo-dev.err.log` and
      `tsup.config.bundled_rpqjbzu1vlq.mjs` are removed
- [ ] `CLUADE.MD` is renamed or removed, and `.gitignore` matches the decision
- [ ] `commit.ps1` and `install.cmd` are removed, or relocated with a stated reason
- [ ] The two working-note files and `Figma/` are handled per the maintainers' answer
      in the issue comments — not unilaterally
- [ ] `.gitignore` covers logs, OS files, tsup artifacts, `smoke-test-fixture/` and
      `*.tgz`
- [ ] `.gitignore` does **not** touch nested lockfiles — that is `ci-07`
- [ ] Every removed filename was grepped for first, and nothing referenced it
- [ ] `pnpm install`, `pnpm build`, `pnpm test` and `pnpm test:package` all pass
      after the removals
- [ ] `git status` is clean after a dev-server run and a smoke-test run
- [ ] No source file is modified
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- The ignore file: `.gitignore`
- The fixture and tarball the smoke test creates: `packages/core/scripts/smoke-test.js`
- Related: `ci-07` (nested lockfiles and the nested workspace file),
  `pkg-04` (the tsup artifact's origin), `repo-02` (community health files)

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
- **Ask before deleting anything not on the delete-outright list.** Deletions are
  hard to review and easy to regret.
- **Check the references above** before starting. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
