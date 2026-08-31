---
name: "Test 03: the Jest config resets away its own mocks"
about: resetMocks wipes module-scope mock implementations, tests are typechecked by nothing, and the suite runs single-threaded
title: "fix(test): correct the Jest configuration — reset semantics, typechecking, and workers"
labels: bug, testing, help wanted
---

## The Jest config resets away its own mocks

**Complexity:** Low (50 points)
**Estimated time:** 1 day

---

### Context

`packages/core/jest.config.js` sets all three reset options at once:

```js
clearMocks: true,
resetMocks: true,
restoreMocks: true,
```

These are not additive settings — `resetMocks` implies `clearMocks`, and
`resetMocks` does something the manual mock in this repo cannot survive.

`resetMocks: true` runs `jest.resetAllMocks()` before every test, and that
**removes mock implementations**, not just call history. The manual SDK mock
defines its implementation at module scope, once, when the module is first loaded:

```ts
// packages/core/src/__mocks__/@stellar/stellar-sdk.ts
export const Keypair = {
  random: jest.fn(() => ({
    publicKey: () => "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
    secret: () => "SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
  })),
}
```

The module is loaded once per test file. `resetAllMocks` then runs before _each
test in that file_. After the first test, `Keypair.random` is a bare `jest.fn()`
that returns `undefined` — so `Keypair.random().publicKey()` throws
`TypeError: Cannot read properties of undefined`.

The reason this has not bitten hard yet is that the affected mock is only reached
by the integration tests, which are separately broken (`test-02`). It will bite the
moment anyone in this wave writes a second test in a file that mocks something at
module scope — which is most of them.

Two smaller problems in the same file:

**Tests are typechecked by nothing.** `pnpm typecheck` runs
`tsc --noEmit -p packages/core/tsconfig.json`, and that tsconfig has:

```json
"exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
```

`ts-jest` compiles each test file in isolation, so a type error in a test does not
fail the run either. Between the two, a test file can contain type errors that no
command in this repository will ever report.

**The suite is single-threaded.** `maxWorkers: 1` runs every test file serially on
one core. With roughly thirty test files today — and this wave adding many more —
that is the difference between a fast feedback loop and a slow one.

---

### Why this matters

Every issue in this wave ends with "`pnpm test` passes". This is the configuration
those tests run under. A mock framework that silently discards implementations
between tests produces failures that look like product bugs and cost contributors
hours to trace back to a config line they never read.

---

### Where this lives

- `packages/core/jest.config.js`
- `packages/core/tsconfig.json` — or a new `tsconfig.test.json`
- `package.json` (root `typecheck` script, if you add a second config)

---

### Implementation guidelines

- **Keep `clearMocks: true`. Drop `resetMocks` and `restoreMocks`.**
  `clearMocks` resets call history between tests, which is what you actually want,
  and leaves implementations intact. `restoreMocks` only affects `jest.spyOn`
  spies; if a specific test needs restoration it can call `jest.restoreAllMocks()`
  itself, locally, where a reader can see it.
- **Prove the fix.** Add a test file with two tests that both call the same
  module-scope mock and assert it still behaves in the second one. On `dev` today
  that test fails; after the change it passes. Without this the change is
  unverifiable and someone will re-add the flags in six months.
- **Get tests into typechecking.** Either drop the test globs from `exclude` in
  `packages/core/tsconfig.json`, or — cleaner — add a `tsconfig.test.json` that
  extends it and includes them, and run both from the root `typecheck` script.
  Expect this to surface real type errors in existing test files. **Fix them in
  this PR**; that is the point of the change, and it is why this issue is worth
  more than its line count suggests. If one is genuinely large, say so in the PR
  rather than silencing it with `any` — `@typescript-eslint/no-explicit-any` is set
  to `error` in `.eslintrc.json` and will stop you anyway.
- **Try removing `maxWorkers: 1`.** Jest workers are separate processes, so module
  state does not leak between test _files_ and the setting is probably a leftover.
  Remove it, run the suite several times, and report the before/after timings in
  the PR. If a test turns out to be genuinely order-dependent, leave the setting
  in place, add a comment naming the test that requires it, and open a follow-up
  issue — do not paper over a real isolation bug with a global serial mode.
- Do not change `moduleNameMapper` here — `test-02` owns it. Do not extend the mock
  itself — that is `test-04`.

---

### Acceptance criteria

- [ ] `resetMocks` and `restoreMocks` are removed; `clearMocks` remains
- [ ] A test proves a module-scope mock implementation survives into a second test
      in the same file — and that test fails on `dev` before the fix
- [ ] Test files are included in `pnpm typecheck`
- [ ] Every type error that surfaces is fixed, with no new `any`
- [ ] `maxWorkers: 1` is removed, or kept with a comment naming the test that
      requires it and a linked follow-up issue
- [ ] Before/after suite timings are in the PR description
- [ ] The full unit suite passes
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

- The three conflicting flags: `packages/core/jest.config.js`
- The module-scope mock they break: `packages/core/src/__mocks__/@stellar/stellar-sdk.ts`
- The exclusion that skips tests: `packages/core/tsconfig.json`
- The typecheck script: root `package.json`
- Related: `test-02` (the mapper), `test-04` (the mock), `ci-01` (running any of this)
- `resetMocks`: https://jestjs.io/docs/configuration#resetmocks-boolean

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
