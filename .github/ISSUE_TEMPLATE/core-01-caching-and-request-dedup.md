---
name: "Core 01: No caching or request deduplication"
about: RFC and implementation for a shared data layer so N components issue one request
title: "feat(core): add a caching and request-deduplication layer"
labels: enhancement, performance, help wanted
---

## Add a caching and request-deduplication layer

**Complexity:** Very High (300 points)
**Estimated time:** ~1 week

---

### Context

There is no cache and no request deduplication anywhere in `use-stellar`. Every
hook instance owns its own `useState` and issues its own request:

- Two components calling `useBalance({ address: X })` fire two `loadAccount`
  requests for the same address.
- N components fire N requests.
- Nothing is shared between them.
- Nothing survives an unmount/remount — navigating away and back refetches
  everything from scratch.

The package describes itself as "the wagmi of Stellar", and wagmi ships TanStack
Query as its data layer. This is the largest missing subsystem between this library
and its stated benchmark.

**This issue starts with an RFC, not a PR.** Comment your design on the issue and
get agreement before writing implementation code.

---

### Why this matters

A dashboard rendering a balance widget, an account panel, and a payment list for
the same address issues three overlapping Horizon requests on every mount. Public
Horizon rate-limits aggressively, so this is what makes `state-02`'s
"transient 429 blanks the UI" scenario *likely* rather than theoretical — and it is
why `core-08`'s backoff work is needed at all.

It is also the difference between the library being usable for a real app and
being usable for a demo page with one hook on it.

---

### Where this lives

- New: `packages/core/src/cache/` (store, keys, provider wiring)
- Provider: `packages/core/src/context/StellarProvider.tsx`
- Every fetching hook under `packages/core/src/hooks/`
- Types: `packages/core/src/types/index.ts`
- Export: `packages/core/src/index.ts`
- Docs: `docs/guides/` (a new caching guide)

---

### Design options for the RFC

Write these up on the issue with a recommendation and get agreement first.

1. **Peer-dependency TanStack Query.** Least code, matches wagmi exactly, battle
   tested. Costs consumers a required dependency and a `QueryClientProvider` in
   their tree — and forces a version constraint on every downstream app.
2. **Internal keyed store.** A `Map` of `queryKey → { promise, data, timestamp,
   subscribers }` with in-flight promise sharing, configurable `staleTime`, and
   reference-counted garbage collection. More code to write and maintain, zero
   consumer burden, full control over the Stellar-specific bits.
3. **Adapter interface.** Ship option 2 as the default and expose an interface so
   consumers can inject TanStack Query if they already use it. Most flexible,
   largest API surface, and the interface itself becomes a compatibility contract.

Whichever you propose, the RFC needs to answer: what is the query key for each
hook, what invalidates it, what happens on a write (does `send()` invalidate the
sender's balance?), and how `watch: true` polling interacts with `staleTime`.

---

### Suggested API sketch

```tsx
<StellarProvider
  network="testnet"
  queryConfig={{ staleTime: 30_000, gcTime: 300_000 }}
>
```

```ts
// per-hook override
useBalance({ address, staleTime: 0 })   // always refetch
```

---

### Implementation guidelines

- **No breaking changes to hook return shapes.** Every hook keeps returning
  `{ data…, loading, error, refetch }`. The cache is an implementation detail, and
  a consumer who does not opt in should see identical behaviour.
- **In-flight sharing is the deduplication mechanism.** Two subscribers to the same
  key during a live request await the same promise. This is separate from caching
  and is the part that fixes the N-requests problem immediately.
- Query keys must include everything that changes the result: the address, the
  network **and** the resolved `horizonUrl` (see `bug-04`), the limit, the order,
  the cursor. A key that omits the Horizon URL will serve a private node's data to
  a public-node query.
- **Reference-counted GC.** Entries with zero subscribers are evicted after
  `gcTime`. Do not let the store grow unbounded in a long-lived SPA.
- Land **`bug-02`** first. A provider whose context value churns every render will
  fight any cache you put behind it.
- Coordinate with **`core-02`** (`AbortSignal`). The two pair naturally: the cache
  decides *whether* to fetch, the abort signal decides *when to stop*. Agree the
  boundary between them in the RFC.
- Document the whole thing in a new `docs/guides/caching.md` — `staleTime` vs
  `gcTime`, what invalidates on writes, and how to opt out.

---

### Acceptance criteria

- [ ] An RFC comment on the issue, **agreed before implementation starts**
- [ ] Two components mounting the same query issue **exactly one** network request
- [ ] `staleTime` and `gcTime` configurable on the provider and overridable per hook
- [ ] Unmount/remount within `gcTime` serves from cache with no request
- [ ] Cache entries are evicted after `gcTime` with zero subscribers — a test proves
      the store does not grow unbounded
- [ ] Query keys include the resolved Horizon URL, not just the network name
- [ ] Existing hook return shapes unchanged — no breaking change
- [ ] `docs/guides/caching.md` written
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

- Every hook this touches: `packages/core/src/hooks/`
- The provider to wire into: `packages/core/src/context/StellarProvider.tsx`
- Related: `bug-02` (land first), `core-02` (abort), `core-08` (backoff),
  `state-02` (the symptom this makes rarer)
- wagmi's data layer: https://wagmi.sh/react/api/WagmiProvider
- TanStack Query concepts: https://tanstack.com/query/latest/docs/framework/react/guides/caching

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
