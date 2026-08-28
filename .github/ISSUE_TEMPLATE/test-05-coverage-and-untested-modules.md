---
name: "Test 05: no coverage measurement, duplicate test files, and untested modules"
about: Coverage is never collected or enforced, two hooks have duplicate test files, and three modules have no tests at all
title: "test(core): measure coverage, dedupe test files, and cover the gaps"
labels: testing, help wanted
---

## No coverage measurement, duplicate test files, and untested modules

**Complexity:** Medium (100 points)
**Estimated time:** 2 days
**Depends on:** `ci-01` (tests must run in CI before coverage means anything)

---

### Context

Nothing in this repository measures test coverage. `jest.config.js` sets no
`collectCoverage`, no `collectCoverageFrom`, and no `coverageThreshold`; no script
passes `--coverage`; no workflow uploads a report. `coverage/` is in `.gitignore`,
which is the only evidence anyone ever ran it.

The result is that nobody — maintainer or contributor — can answer "is this
covered?" without reading every test file by hand. Three concrete gaps are visible
just from the file listing.

**Duplicate test files.** Two hooks have both a `.ts` and a `.tsx` test:

- `useAddTrustline.test.ts` **and** `useAddTrustline.test.tsx`
- `useBalance.test.ts` **and** `useBalance.test.tsx`

`testMatch` picks up both. This is almost certainly a rename that was committed
without deleting the original, and it means two suites for one hook that can drift
apart — with the stale one still passing and still counted.

**Modules with no test file at all:**

- `packages/core/src/hooks/usePaymentHistory.ts` — a public, exported hook with
  zero tests
- `packages/core/src/errors/StellarError.ts` — the error class every hook throws
- `packages/core/src/errors/codes.ts` — including `isStellarErrorCode()`, a type
  guard with real branching logic

---

### Why this matters

This wave adds seventeen hooks and eight core changes, and every issue asks for
tests. Without a coverage number there is no way to tell a PR that genuinely tests
its change from one that adds a single happy-path assertion — and no way to notice
when the ratio drifts over a wave this size.

`usePaymentHistory` is the sharper problem: it is exported from the package index
and has never been tested. `state-08` is scheduled to rewrite its filtering.
Rewriting an untested hook is guesswork.

---

### Where this lives

- `packages/core/jest.config.js`
- `packages/core/package.json` (a `test:coverage` script)
- `.github/workflows/ci.yml` (coverage step)
- `packages/core/src/hooks/useAddTrustline.test.ts` / `.test.tsx` — one is deleted
- `packages/core/src/hooks/useBalance.test.ts` / `.test.tsx` — one is deleted
- `packages/core/src/hooks/usePaymentHistory.test.ts` — new
- `packages/core/src/errors/StellarError.test.ts` — new
- `packages/core/src/errors/codes.test.ts` — new

---

### Implementation guidelines

- **Turn coverage on.** Add `collectCoverageFrom` scoped to `src/**/*.{ts,tsx}` with
  `__mocks__`, `__tests__`, `*.test.*` and type-only files excluded. Add a
  `test:coverage` script. Report `text-summary` locally and `lcov` for CI.
- **Set the threshold to roughly where the project is now, not to an aspiration.**
  Run coverage first, read the number, then set `coverageThreshold` a little below
  it. A threshold nobody can meet gets deleted within a month; a threshold that
  ratchets holds. Say in the PR what the measured number was and what you set.
- **Merge the duplicate test files, do not just delete one.** Read both, keep every
  distinct case, and land a single file per hook. Deleting the larger one silently
  loses coverage. Prefer `.tsx` where the test renders a component or uses
  `renderHook` with a JSX wrapper. State in the PR which cases you carried across.
- **Test `usePaymentHistory` properly.** Read the hook first, then cover: the happy
  path, an empty result, a Horizon error, the `enabled: false` path if it has one,
  cleanup on unmount, and whatever filtering it does today. Do **not** change the
  hook's behaviour in this PR even if you find a bug — open a separate issue and
  link it. A test that encodes today's behaviour is still valuable; `state-08`
  needs a baseline to change against.
- **Test the error modules.** `StellarError`: construction, `code`, `message`,
  `name`, `instanceof`, and that it survives being thrown and caught.
  `codes.ts`: `isStellarErrorCode` for every valid code, plus `null`, `undefined`,
  a number, an object, and a string that is not a code.
- **Add coverage to CI** once `ci-01` has landed. Uploading to a service is optional
  — printing the summary in the job log is enough to start, and needs no secrets.
- Do not chase a coverage number by testing trivial getters. If a module is hard to
  cover, that is usually a design signal worth an issue of its own.

---

### Acceptance criteria

- [ ] `pnpm test:coverage` produces a report
- [ ] `collectCoverageFrom` excludes mocks, tests, and type-only files
- [ ] A `coverageThreshold` is set, based on the measured baseline, and the measured
      number is stated in the PR
- [ ] Exactly one test file remains for `useAddTrustline` and one for `useBalance`
- [ ] The PR states which cases were carried across from the deleted duplicates
- [ ] `usePaymentHistory` has tests covering success, empty, error, and unmount
- [ ] `usePaymentHistory`'s behaviour is unchanged by this PR
- [ ] `StellarError` and `isStellarErrorCode` have tests, including non-string and
      unknown-string inputs
- [ ] CI prints the coverage summary
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

- Config with no coverage settings: `packages/core/jest.config.js`
- The untested hook: `packages/core/src/hooks/usePaymentHistory.ts`
- The untested error modules: `packages/core/src/errors/StellarError.ts`,
  `packages/core/src/errors/codes.ts`
- Related: `ci-01` (land first), `test-03`, `test-04`, `state-08` (needs the
  `usePaymentHistory` baseline this issue creates)
- Jest coverage: https://jestjs.io/docs/configuration#collectcoveragefrom-array

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
- **Follow existing conventions** — match the surrounding tests.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
