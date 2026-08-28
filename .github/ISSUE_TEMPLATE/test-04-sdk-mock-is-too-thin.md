---
name: "Test 04: the SDK mock is too thin to test the library with"
about: The mock has no TransactionBuilder, Asset, Networks, StrKey or rpc — so the hooks that matter most cannot be tested
title: "test(core): build out the Stellar SDK test double"
labels: testing, help wanted
---

## The SDK mock is too thin to test the library with

**Complexity:** Medium (100 points)
**Estimated time:** 2 to 3 days

---

### Context

`packages/core/src/__mocks__/@stellar/stellar-sdk.ts` is mapped in for every test
in the package. It exports:

- `Horizon.Server` — backed by `MockHorizonServer`, which implements exactly three
  methods: `loadAccount`, `transactions`, and `claimableBalances`
- `Keypair` — with a single hardcoded pair

That is the whole surface. It does **not** export `TransactionBuilder`, `Asset`,
`Operation`, `Networks`, `Memo`, `BASE_FEE`, `StrKey`, or anything Soroban.

Follow that through to what can actually be tested:

- `useSendPayment` imports `TransactionBuilder`, `Networks`, `BASE_FEE`,
  `Operation`, `Asset` and `Memo` (`useSendPayment.ts:2-9`). Under the mock every
  one is `undefined`. Any test that reaches line 79 throws — so no test covers
  transaction building, memo handling, fee selection, signing, or submission. This
  is the hook that moves money.
- `MockHorizonServer` has no `submitTransaction` and no `fetchBaseFee`, so the
  submit path has no test double at all.
- No `StrKey`, so `bug-07`'s address validation has nothing to test against.
- No `rpc`/Soroban namespace, so `useSorobanContract` and everything in the Soroban
  track are untestable.
- `mockAccountRecord` is a plain object. The real `loadAccount` returns an
  `AccountResponse` with `accountId()`, `incrementSequenceNumber()`, and the shape
  `TransactionBuilder` requires as a source account.
- `MockHorizonServer` holds one mutable `shouldThrow` field on a module-level
  singleton (`mockHorizonServer`). Every test in a file shares it, and there is no
  reset, so failure simulation leaks between tests.
- The mock's `secret()` returns `"SAAZI4TCR3TY..."` — the public key with its first
  character swapped. It is not a valid Stellar secret key and will fail against
  anything that parses it.

---

### Why this matters

Roughly half the wave's issues touch `useSendPayment`, `useSorobanContract`, or
address validation, and every one of them asks for tests. Right now those tests
cannot be written. A contributor picking up `bug-09` or `hook-use-memo-support`
will hit this wall in their first hour and either give up or ship untested code.

Fixing the mock unblocks more of this wave than any other single testing issue.

---

### Where this lives

- `packages/core/src/__mocks__/@stellar/stellar-sdk.ts`
- Optionally split into `packages/core/src/__mocks__/` fixtures — keep them under
  that directory
- Existing tests under `packages/core/src/hooks/` that need updating

---

### Implementation guidelines

- **Re-export the pure, deterministic parts of the real SDK instead of faking
  them.** `Asset`, `Operation`, `Memo`, `Networks`, `BASE_FEE`, `StrKey` and
  `TransactionBuilder` do no I/O — they build and encode objects. Mocking them
  means your tests assert against your own fake instead of against Stellar's
  encoding rules, which is worse than no test. Fake **only** the network boundary:
  `Horizon.Server` and the Soroban `rpc.Server`.

  ```ts
  const actual = jest.requireActual("@stellar/stellar-sdk")
  export const { Asset, Operation, Memo, Networks, BASE_FEE, StrKey, TransactionBuilder } = actual
  ```

  This one decision is most of the issue. Get it right and the rest is mechanical.

- **Make `loadAccount` return something `TransactionBuilder` accepts.** Use the real
  `Account` class from the SDK, or a `AccountResponse`-shaped object with a working
  `accountId()`, `sequenceNumber()` and `incrementSequenceNumber()`. Building a
  transaction against it must succeed.
- **Add the missing server methods:** `submitTransaction`, `fetchBaseFee`,
  `payments`, `operations`, `offers`, `orderbook`, `strictSendPaths` /
  `strictReceivePaths`, `feeStats`, `assets`. Each should be a `jest.fn()` a test
  can drive, with a sensible default. Give the collection builders the
  `.call()` / `.stream()` / `.cursor()` / `.limit()` / `.order()` chain the real
  ones have, since the hooks use it.
- **Kill the shared mutable singleton.** Replace `mockHorizonServer` +
  `shouldThrow` with a factory — `createMockHorizonServer(overrides)` — so each
  test constructs its own. If the singleton must stay for compatibility, add a
  `reset()` and call it from a `beforeEach`. Leaking failure state between tests is
  the kind of bug that costs a whole afternoon.
- **Use realistic fixtures.** Copy actual Horizon JSON responses from testnet into
  fixture files rather than inventing shapes. Several bugs in this wave —
  `state-06`'s blank Soroban rows, `bug-06`'s precision loss — exist precisely
  because the real response shape differs from what the code assumed. Invented
  fixtures reproduce the assumption instead of the reality.
- **Fix the fake secret key.** Either generate a real testnet keypair and hardcode
  it (it is a throwaway testnet key — say so in a comment), or drop `secret()`.
- Keep every fixture address **testnet**. Never paste a real mainnet account into a
  fixture, even a public one.
- Update any existing test that breaks. If a test was only passing because the mock
  was wrong, fix the test — and call that out in the PR, because it may be
  uncovering a real bug worth its own issue.

---

### Acceptance criteria

- [ ] `Asset`, `Operation`, `Memo`, `Networks`, `BASE_FEE`, `StrKey` and
      `TransactionBuilder` come from the real SDK via `jest.requireActual`
- [ ] A test builds a full payment transaction through `useSendPayment` and asserts
      on the resulting XDR — this is impossible on `dev` today
- [ ] `loadAccount` returns an account object `TransactionBuilder` accepts
- [ ] `submitTransaction` and `fetchBaseFee` exist and are drivable per test
- [ ] Collection builders support the `.call()` / `.cursor()` / `.limit()` /
      `.order()` chain the hooks use
- [ ] A Soroban `rpc.Server` double exists with `getEvents`, `simulateTransaction`
      and `sendTransaction`
- [ ] No shared mutable failure state between tests — proven by a test that
      simulates an error and a following test that expects success
- [ ] Fixtures are copied from real testnet Horizon responses, not invented
- [ ] The invalid `secret()` value is fixed or removed
- [ ] Every fixture address is testnet
- [ ] The existing suite still passes; any test changed because it was passing for
      the wrong reason is called out in the PR
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

- The mock: `packages/core/src/__mocks__/@stellar/stellar-sdk.ts`
- What `useSendPayment` needs from it: `packages/core/src/hooks/useSendPayment.ts:2-9`
- Where the mapper is applied: `packages/core/jest.config.js`
- Related: `test-03` (reset semantics — land it first if you can), `test-02`,
  `bug-07`, `bug-09`, `hook-use-memo-support` (all blocked on this)
- `jest.requireActual`: https://jestjs.io/docs/jest-object#jestrequireactualmodulename
- Horizon response shapes: https://developers.stellar.org/docs/data/apis/horizon/api-reference

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
