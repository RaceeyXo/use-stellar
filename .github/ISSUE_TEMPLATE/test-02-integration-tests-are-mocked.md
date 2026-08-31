---
name: "Test 02: the integration tests run against the mock and cannot pass"
about: A global moduleNameMapper mocks the SDK for the integration suite too, and the workflow that runs it matches no package
title: "fix(test): make the integration suite actually integrate"
labels: bug, testing, ci, help wanted
---

## The integration tests run against the mock, and never run anyway

**Complexity:** Medium (100 points)
**Estimated time:** 1 to 2 days

---

### Context

There are two integration tests, `packages/core/src/__tests__/integration/balance.test.ts`
and `.../payment.test.ts`. Both are written correctly — real keypairs, real
Friendbot, real Horizon. Neither can pass, and neither ever runs. Three separate
faults stack up.

**1. The SDK is mocked for them.** `jest.config.js` applies one mapping to every
test in the package, integration included:

```js
moduleNameMapper: {
  '^@stellar/stellar-sdk$': '<rootDir>/src/__mocks__/@stellar/stellar-sdk.ts'
}
```

So `import { Keypair, Horizon } from "@stellar/stellar-sdk"` in an _integration_
test resolves to the mock. `Keypair.random()` returns the same hardcoded public
key every time. `new Horizon.Server(...)` returns `mockHorizonServer`, whose
`loadAccount` returns a fixed record with a native balance of `"100.0000000"`.

`balance.test.ts` then asserts:

```ts
expect(parseFloat(nativeBalance!.balance)).toBeGreaterThanOrEqual(10000)
```

`100 >= 10000` is false. The test fails.

`payment.test.ts` fails earlier and harder: it imports `TransactionBuilder`,
`Networks`, `Asset` and `Operation`, and the mock exports **none** of them. They
are all `undefined`, so `new TransactionBuilder(...)` throws `TypeError`. The mock
server also has no `fetchBaseFee` and no `submitTransaction`.

Meanwhile the real `fetch` to Friendbot is _not_ mocked — so these tests do make
live network calls, they just make the wrong ones.

**2. The workflow runs zero tests and reports success.**

```yaml
run: pnpm --filter @israelolrunfemi/use-stellar test:integration
```

The package is named `use-stellar` (`packages/core/package.json`). That filter
matches no project, pnpm prints "No projects matched the filters" and exits **0**.
The job goes green. There is even a comment in the file admitting the filter needs
adjusting.

**3. Nothing triggers it.** `integration.yml` is `workflow_dispatch:` only — manual
runs, no schedule, no PR trigger. And its `actions/setup-node` step sets
`cache: "pnpm"` _before_ `pnpm/action-setup` has installed pnpm, so the step cannot
find the binary. In `ci.yml` the two steps are ordered correctly; here they are not.

---

### Why this matters

This is a green check that certifies nothing. Every other test in the repo is a
unit test against a mock, so the integration suite is the only thing that would
catch a genuine break against real Horizon — a changed response shape, a fee
bump, an SDK upgrade. It has never once done so.

Worse, it is _credibly_ green. Anyone glancing at the Actions tab concludes the
library is verified against live testnet.

---

### Where this lives

- `packages/core/jest.config.js` (or a new `jest.integration.config.js`)
- `packages/core/package.json` (`test:integration` script)
- `packages/core/src/__tests__/integration/balance.test.ts`
- `packages/core/src/__tests__/integration/payment.test.ts`
- `.github/workflows/integration.yml`

---

### Implementation guidelines

- **Give the integration suite its own Jest config.** A second config file with no
  `moduleNameMapper`, `testEnvironment: "node"`, and `testMatch` scoped to
  `**/__tests__/integration/**` is cleaner than trying to conditionally disable the
  mapper. Point `test:integration` at it with `--config`.
- **Verify the unmocking actually took.** Add an assertion at the top of the suite
  that the imported SDK is the real one — for example that two consecutive
  `Keypair.random()` calls produce _different_ public keys. The mock returns a
  constant, so this single assertion catches any future regression of exactly this
  bug. This is the most valuable line in the whole issue; do not skip it.
- **Fix the workflow filter** to `use-stellar`, and add a step that fails loudly if
  the filter matched nothing. `pnpm --filter` exiting 0 on an empty match is the
  trap that hid this for as long as it has been hidden.
- **Reorder the setup steps** so `pnpm/action-setup` runs before
  `actions/setup-node`, matching `ci.yml`.
- **Add a `schedule:` trigger** — nightly is right for a suite that costs testnet
  round trips. Keep `workflow_dispatch:` alongside it. Do **not** add it to
  `pull_request`: Friendbot is rate-limited and shared, and a busy PR day would
  exhaust it for everyone.
- **Make the tests tolerant of a live network without making them meaningless.**
  - Friendbot can fail or rate-limit. Check `response.ok` and fail with the body,
    not with a bare assertion. Retry a limited number of times with backoff.
  - Do not assert Friendbot's exact funding amount. `balance.test.ts` asserts
    `>= 10000` today; that number is an SDF policy, not a protocol rule, and it has
    changed before. Assert the account exists and holds a positive native balance.
  - Keep the generous `jest.setTimeout` values — ledgers close every five seconds
    or so and these tests legitimately need the room.
- **Never let these tests touch mainnet.** Hardcode the testnet Horizon URL and
  `Networks.TESTNET`, and assert the passphrase before submitting anything.
- Leave the unit-test mock alone in this issue; making it usable is `test-04`.

---

### Acceptance criteria

- [ ] The integration suite resolves the **real** `@stellar/stellar-sdk`
- [ ] A test asserts two `Keypair.random()` calls differ, proving the mock is not
      in play
- [ ] `balance.test.ts` passes against live testnet
- [ ] `payment.test.ts` passes against live testnet
- [ ] The funding-amount assertion no longer hardcodes 10,000 XLM
- [ ] Friendbot failures surface the response body and are retried with backoff
- [ ] `pnpm --filter` in `integration.yml` matches `use-stellar`, and a zero-match
      filter fails the job instead of passing it
- [ ] `pnpm/action-setup` runs before `actions/setup-node`
- [ ] The workflow runs on a schedule as well as on manual dispatch
- [ ] The workflow is **not** attached to `pull_request`
- [ ] `pnpm test` (the unit suite) still excludes integration and still passes
- [ ] Every test uses **testnet only** — no mainnet addresses, no mainnet Horizon
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

- The mapper that mocks everything: `packages/core/jest.config.js`
- The mock that lacks `TransactionBuilder`: `packages/core/src/__mocks__/@stellar/stellar-sdk.ts`
- The failing assertion: `packages/core/src/__tests__/integration/balance.test.ts`
- The wrong filter, with its own apologetic comment: `.github/workflows/integration.yml`
- The correct step ordering to copy: `.github/workflows/ci.yml`
- Related: `ci-01` (unit tests in CI), `test-04` (making the mock usable)
- Friendbot: https://developers.stellar.org/docs/learn/fundamentals/networks#friendbot

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
