---
name: "Vue 11: Extract a framework-neutral query observer from useQuery"
about: Move fetch, dedup, freshness, and subscription orchestration out of the React useQuery hook into a React-free observer both adapters can drive.
title: "refactor(core): extract a framework-neutral QueryObserver from useQuery"
labels: enhancement, vue, framework-agnostic, refactor
---

## Extract a framework-neutral query observer from useQuery

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-02`, `vue-04`

---

### Context

`packages/core/src/cache/useQuery.ts` mixes two concerns: React state projection
and the actual query orchestration — in-flight deduplication, `staleTime`
freshness checks, forced refetch, and writing results back to `QueryStore`. Only
the first concern is React-specific.

`vue-09` proved Vue can consume `QueryStore`, but porting eighteen more read
APIs would copy that orchestration into every composable. Extract it once into a
`QueryObserver` that React and Vue both adapt.

---

### Why this matters

Dedup and freshness rules are where caches silently diverge. If Vue
re-implements them, a React component and a Vue island on the same page can
issue duplicate Horizon requests or treat the same entry as stale at different
times.

---

### Where this lives

- New: `packages/core/src/cache/observer.ts`
- New: `packages/core/src/cache/observer.test.ts`
- Update: `packages/core/src/cache/useQuery.ts`
- Update: `packages/core/src/cache/index.ts`
- Update: `packages/core/src/core.ts` (the `use-stellar/core` entry from `vue-04`)

---

### Implementation guidelines

- Create `createQueryObserver({ store, queryKey, queryFn, staleTime, enabled })`
  exposing `getSnapshot()`, `subscribe(listener)`, `fetch({ force })`,
  `setOptions(next)`, and `destroy()`.
- Move the dedup, freshness, `setLoading`/`setData`/`setError` sequence verbatim
  from `useQuery`; behavior must not change.
- `setOptions` must switch keys atomically: unsubscribe the old key, subscribe
  the new one, and run one fetch.
- Rewrite `useQuery` as a thin React adapter over the observer and keep its
  return shape exactly as today.
- The observer must not import React, Vue, or browser globals.

---

### Acceptance criteria

- [ ] The observer is unit-tested in plain TypeScript with a fake timer and no DOM
- [ ] Two observers on one key share a single in-flight promise
- [ ] Fresh data within `staleTime` is not refetched; `fetch({ force: true })` always is
- [ ] Switching keys never leaks a subscription or leaves the old entry’s subscriber count raised
- [ ] `enabled: false` never fetches and never subscribes
- [ ] Every existing `useQuery` and cache integration test passes unchanged
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Current orchestration: `packages/core/src/cache/useQuery.ts`
- Store API: `packages/core/src/cache/store.ts`
- Cache integration tests: `packages/core/src/cache/integration.test.tsx`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- This is an extraction, not a behavior change: keep `useQuery`’s return shape
  and timing.
- Do not import React or Vue from `packages/core/src/runtime`, `queries`, or
  `actions`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
