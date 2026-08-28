---
name: "Core 02: No request cancellation anywhere"
about: Thread AbortSignal through every fetching hook so superseded requests are actually cancelled
title: "feat(core): thread AbortSignal through every fetching hook"
labels: enhancement, performance, help wanted
---

## Thread `AbortSignal` through every fetching hook

**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

---

### Context

There is no `AbortController` anywhere in the library. The best any hook does is
an **ignore flag**: `useBalance`'s monotonic `requestRef` (`useBalance.ts:54-99`),
mirrored in `useClaimableBalance` and `useFederationLookup`.

An ignore flag discards the *response*. It does not cancel the *request*. The
HTTP call still goes out, still occupies a connection, still counts against the
rate limit, and still completes — the result is simply thrown away when it
arrives.

The SDK's `CallBuilder` accepts an axios request config, which is where an
`AbortSignal` can be attached.

---

### Why this matters

Rapid typing in an address search box issues an unbounded number of live Horizon
requests. Ten keystrokes means ten requests in flight, nine of whose responses are
discarded — but all ten hit the endpoint. On a rate-limited endpoint the user gets
429'd **by their own typing**, and then `state-02` blanks their UI for it.

Unmounting a component with `watch: true` has the same shape: the interval is
cleared, but any request already in flight runs to completion.

---

### Where this lives

- All thirteen fetching hooks under `packages/core/src/hooks/`
- Helper: `packages/core/src/utils/index.ts` (`getHorizonServer`)
- Errors: `packages/core/src/errors/factory.ts`
- Tests: the corresponding `*.test.ts` / `*.test.tsx` files

---

### Implementation guidelines

- **One controller per fetch, aborted in the effect cleanup.** Create the
  `AbortController` at the top of the fetch, store it in a ref, and call `.abort()`
  both in the cleanup and at the start of the next fetch (superseding an in-flight
  request should cancel it, not just ignore it).
- **Thread the signal to the transport.** The SDK's `CallBuilder` methods take an
  axios config — pass `{ signal }` through. Verify it actually reaches axios rather
  than being silently dropped; that is the whole point of this issue and the
  acceptance criterion below is explicit about it.
- **`AbortError` is not an error.** A deliberate abort must **not** set `error`
  state. `toStellarError` (`errors/factory.ts:109-120`) currently classifies
  anything mentioning "timeout"/"network" as `NETWORK_ERROR`, and an abort will
  fall into the `UNKNOWN` fallback at line 123 — either way it would surface a
  spurious error to the user. Detect the abort **before** calling `toStellarError`
  and return early.
- Do not remove the existing `requestRef` ignore flags. Abort and ignore solve
  overlapping but not identical problems: an abort can lose a race with a response
  that is already parsed. Keep both.
- The `AbortSignal` should also be exposed to callers where it makes sense — a
  consumer calling `refetch()` may want to cancel it. Decide whether that is in
  scope and say so in the PR; the minimum bar is internal cancellation.
- **Coordinate with `core-01`.** If the cache lands first, cancellation semantics
  change: a shared in-flight promise must not be aborted by one subscriber
  unmounting while others still wait. Agree the boundary on `core-01`'s RFC before
  building either.
- Land **`state-01`** and **`state-03`** first — they fix the ignore-flag handling
  this builds on.

---

### Acceptance criteria

- [ ] Every hook that fetches aborts its in-flight request on unmount **and** on
      query change
- [ ] An aborted request never sets `error` state
- [ ] A test asserts the abort **actually reached the transport** — assert on the
      axios/fetch call receiving the signal, or that the request was cancelled, not
      merely that the response was ignored
- [ ] A superseded request is cancelled, not just discarded
- [ ] `watch: true` polling cancels any in-flight request on unmount
- [ ] The existing `requestRef` ignore flags still work alongside the signals
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

- The best existing guard, which is still only an ignore flag:
  `packages/core/src/hooks/useBalance.ts:54-99`
- Where an abort would be misclassified: `packages/core/src/errors/factory.ts:109-123`
- Related: `core-01` (agree the boundary first), `state-01`, `state-03`
- `AbortSignal`: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
- axios cancellation: https://axios-http.com/docs/cancellation

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
