---
name: "Core 06: Errors are classified by substring matching"
about: Replace brittle .message heuristics with structured Horizon result codes
title: "fix(errors): replace brittle substring matching with structured result codes"
labels: bug
---

## Replace brittle substring matching with structured result codes

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days
**Depends on:** `core-05`

---

### Context

`toStellarError` is the single funnel every error in the library passes through
before reaching a consumer. Its job is to turn an unknown thrown value into a
`StellarError` with a `code` consumers can branch on.

It has the right structure — a documented precedence chain at
`packages/core/src/errors/factory.ts:39-49`, structured `result_codes` first, HTTP
status second, heuristics last. The problem is how much work the heuristics end up
doing, and how loose they are.

---

### The defect

`packages/core/src/errors/factory.ts:86`

```ts
if (status === 404 || /\b404\b/.test(rawMessage)) {
  return createStellarError("ACCOUNT_NOT_FOUND", undefined, { raw: error })
}
```

**Any** error whose message contains the digits `404` becomes `ACCOUNT_NOT_FOUND`.
A CORS failure mentioning a URL with `404` in it. A stack trace with a line number
404. A wrapped error whose inner message quoted an unrelated 404.

`packages/core/src/errors/factory.ts:91-99`

```ts
const lower = rawMessage.toLowerCase()
if (
  lower.includes("user declined") ||
  lower.includes("user rejected") ||
  lower.includes("rejected") ||      // ← bare "rejected"
  lower.includes("denied")
) {
  return createStellarError("WALLET_REQUEST_REJECTED", undefined, { raw: error })
}
```

The bare `"rejected"` substring is the dangerous one. "Transaction rejected by the
network" is a *network* rejection, and it reports as **the user cancelled in their
wallet**. Those need opposite UI: one is "try again", the other is "you cancelled".

Note the first two entries are redundant — `"user declined"` and `"user rejected"`
are both subsumed by the looser checks below them, which is a good sign the list
grew by accretion rather than design.

---

### Why this matters

Classification by substring is guessing, and consumers branch on `err.code` to
decide what to render. A wrong code produces a wrong UI with full confidence.

These heuristics also break on any change outside our control: an SDK error
message reword, a Horizon response format tweak, a non-English locale. Nothing in
the test suite would catch it, because the tests assert against the same strings
the implementation matches on.

---

### Where this lives

- Errors: `packages/core/src/errors/factory.ts`
- Test: `packages/core/src/errors/factory.test.ts`
- Fixtures: `packages/core/src/__tests__/fixtures/` (create)
- Docs: `docs/guides/error-handling.md`

---

### Implementation guidelines

- **Read the structured fields first, exhaustively:**
  - `err.response?.status` — the HTTP status, already partly used at line 83
  - `err.response?.data?.extras?.result_codes?.transaction`
  - `err.response?.data?.extras?.result_codes?.operations[]`
  - Horizon's problem-details fields: `type`, `title`, `detail`, `status`

  The `getResponse` helper at `factory.ts:31-37` already extracts the response
  safely — extend its interface rather than writing a second extractor.
- **Horizon speaks RFC 7807 problem details.** The `type` field is a stable URI
  like `https://stellar.org/horizon-errors/not_found` — far more reliable than
  either the status code or the prose. Use it where present.
- **Keep string heuristics only as a genuine last resort**, and tighten them:
  - Drop `/\b404\b/.test(rawMessage)` entirely — a status-less error mentioning
    404 is not evidence of a missing account.
  - Remove the bare `"rejected"`; keep the anchored `"user rejected"` /
    `"user declined"` forms which are what wallets actually emit.
  - Anchor patterns where possible rather than using `includes`.
- **Do not regress the wallet path.** `core-04` makes `WalletAdapterError` codes
  authoritative; this issue must not reintroduce message-matching ahead of them.
  Land `core-04` first if both are in flight.
- **Build a fixture set from real Horizon error bodies** and commit it under
  `src/__tests__/fixtures/`. Capture real responses from testnet — a 404 for a
  missing account, a 400 with `tx_bad_seq`, a 400 with `op_no_destination`, a 429,
  a 504. These same fixtures feed `test-03`'s MSW handlers, so make them reusable.
- Update the precedence documentation in the JSDoc at `factory.ts:39-49` to match
  what the code actually does after your change. It is currently accurate; keep it
  that way.

---

### Acceptance criteria

- [ ] Classification reads `result_codes` and problem-details `type` before touching
      `.message`
- [ ] A network error containing the literal "404" in its message is **not**
      classified `ACCOUNT_NOT_FOUND`
- [ ] "Transaction rejected by the network" is **not** classified
      `WALLET_REQUEST_REJECTED`
- [ ] A real wallet cancellation still classifies as `WALLET_REQUEST_REJECTED`
- [ ] `op_no_destination` → `DESTINATION_NOT_FOUND` (from `core-05`)
- [ ] `tx_bad_seq` → `SEQUENCE_MISMATCH`
- [ ] Fixture set built from **real recorded** Horizon error bodies, committed under
      `src/__tests__/fixtures/`
- [ ] The JSDoc precedence chain matches the implementation
- [ ] No existing correct classification regresses — the current `factory.test.ts`
      suite still passes
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

- The heuristics: `packages/core/src/errors/factory.ts:86,91-99`
- The response extractor to extend: `packages/core/src/errors/factory.ts:20-37`
- The documented precedence chain: `packages/core/src/errors/factory.ts:39-49`
- Related: `core-04` and `core-05` (land first), `core-07` (the 504 path),
  `test-03` (reuses your fixtures)
- Horizon errors: https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors
- RFC 7807 problem details: https://datatracker.ietf.org/doc/html/rfc7807

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
- **Follow existing conventions** — match the surrounding hooks.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
