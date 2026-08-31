---
name: "Core 08: RATE_LIMITED exists but nothing ever retries"
about: Handle Horizon 429 with Retry-After, exponential backoff, and adaptive polling
title: "feat(core): handle Horizon 429 rate limiting with backoff"
labels: enhancement, performance
---

## Handle Horizon 429 rate limiting with backoff

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

Public Horizon rate-limits by IP. When you exceed the quota it returns **HTTP 429**
with a `Retry-After` header telling you exactly how long to wait.

`use-stellar` already recognises the status — `packages/core/src/errors/factory.ts:83-85`:

```ts
if (status === 429) {
  return createStellarError("RATE_LIMITED", undefined, { raw: error })
}
```

and `RATE_LIMITED` has a friendly default message at `codes.ts:57`. But **nothing
in the library ever retries, backs off, or reads `Retry-After`.** The code is
decoration: it names the problem and then hands it to the consumer unsolved.

---

### The gap

Three facts compound:

1. `useBalance({ watch: true })` polls every **10 seconds** by default
   (`useBalance.ts:9`).
2. There is no request deduplication (**`core-01`**), so N hooks on one address
   means N requests per cycle.
3. There is no backoff, so a rate-limited client keeps hammering on exactly the
   same schedule — the interval at `useBalance.ts:91` is fixed.

A dashboard with a balance widget, an account panel, and a payment list on one
address hits the limit routinely. When it does, `state-02` blanks the UI for it.

---

### Why this matters

The failure looks like the library is broken. The user sees an opaque error, the
data disappears, and ten seconds later it happens again — while the client keeps
sending requests that are guaranteed to be rejected, making the rate-limit window
longer.

Reading `Retry-After` is not optional politeness; it is the difference between
recovering in one cycle and being throttled indefinitely.

---

### Where this lives

- New: `packages/core/src/utils/retry.ts` (or `packages/core/src/net/`)
- Provider: `packages/core/src/context/StellarProvider.tsx` (retry policy config)
- Hooks: every fetching hook under `packages/core/src/hooks/`, especially those
  supporting `watch`
- Errors: `packages/core/src/errors/factory.ts`
- Types: `packages/core/src/types/index.ts`
- Docs: `docs/guides/networks.md` or a new section
- Tests: a new retry test suite plus per-hook coverage

---

### Implementation guidelines

- **Respect `Retry-After` first.** It comes as either a delay in seconds or an HTTP
  date — handle both. Only fall back to computed backoff when the header is absent
  or unparseable. Never retry sooner than the header says.
- **Exponential backoff with jitter** for the fallback. Full jitter
  (`random(0, base * 2^attempt)`) is the right default; without jitter, every hook
  in the app retries in lockstep and re-triggers the limit together.
- **Bound the retries.** After the cap is reached, surface `RATE_LIMITED` and stop.
  An unbounded retry loop is a worse bug than the one being fixed.
- **Make `watch` polling adaptive.** While rate-limited, the polling interval must
  back off too, and recover to the configured interval after a success. A hook that
  retries politely and then resumes hammering every 10s has not fixed anything.
- **Only retry idempotent reads.** `GET` requests are safe. **Never** auto-retry
  `submitTransaction` — that is `core-07`'s territory and auto-retrying a submit is
  precisely how you double-send. Make this explicit in the implementation, not just
  in a comment.
- Expose the policy on the provider:

  ```tsx
  <StellarProvider retryConfig={{ maxRetries: 3, baseDelay: 1000, maxDelay: 30_000 }}>
  ```

  with sane defaults so nobody has to configure it.

- Coordinate with **`core-01`**: if a cache lands, retry belongs at the fetch layer
  the cache calls, not duplicated in each hook. Agree the boundary on that RFC.
- Coordinate with **`core-02`**: a retry must abort when the query changes or the
  component unmounts. A backoff timer that outlives its component is a leak.

---

### Acceptance criteria

- [ ] A mocked 429 with `Retry-After: 5` is retried after **5 seconds**, not immediately
- [ ] Both the seconds and HTTP-date forms of `Retry-After` are handled
- [ ] Retries are bounded and surface `RATE_LIMITED` when exhausted
- [ ] Backoff uses jitter — a test asserts two concurrent hooks do not retry in lockstep
- [ ] `watch` polling backs off while rate-limited and recovers to the configured
      interval afterwards
- [ ] **`submitTransaction` is never auto-retried**
- [ ] Retry policy is configurable via the provider, with defaults that need no config
- [ ] A pending retry is cancelled on unmount and on query change
- [ ] Documented, including the "we never retry writes" rule and why
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

- The code that exists but does nothing: `packages/core/src/errors/factory.ts:83-85`,
  `packages/core/src/errors/codes.ts:57`
- The fixed polling interval: `packages/core/src/hooks/useBalance.ts:9,91`
- Related: `core-01` (dedup — agree the layering), `core-02` (cancellation),
  `core-07` (why writes are never retried), `state-02` (the UI symptom)
- Horizon rate limiting: https://developers.stellar.org/docs/data/apis/horizon/api-reference/structure/rate-limiting
- `Retry-After`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After

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
