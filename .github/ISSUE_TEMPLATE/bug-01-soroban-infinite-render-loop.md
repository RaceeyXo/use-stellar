---
name: "Bug 01: useSorobanContract infinite render loop"
about: Stop useSorobanContract from calling simulateTransaction on every render forever
title: "fix(hooks): stop useSorobanContract from looping simulateTransaction forever"
labels: bug, critical, hook, soroban
---

## Stop `useSorobanContract` looping `simulateTransaction` forever

**Complexity:** Medium (150 points)
**Estimated time:** 1 day

---

### Context

`useSorobanContract` performs a read-only Soroban contract call: it builds a
transaction, hands it to `SorobanRpc.Server.simulateTransaction`, and decodes the
returned `ScVal`. Simulation is a **network round-trip to a Soroban RPC endpoint**
— the public SDF testnet RPC, or whatever `networkConfig.sorobanUrl` points at.

The hook is supposed to simulate once per unique `(contractId, method, args)`
tuple. It does not. It simulates on every render, forever, in an unbounded loop.

To work on this you need to understand two React identity rules:

1. A default parameter value like `args = []` allocates a **brand new array on
   every call**. It is never referentially equal to the previous render's array.
2. `useCallback` compares its dependencies with `Object.is`. A new array or a new
   object in the dependency list produces a new callback identity, which
   invalidates any `useEffect` that depends on that callback.

---

### The defect

`packages/core/src/hooks/useSorobanContract.ts:48-52`

```ts
export function useSorobanContract({
  contractId,
  method,
  args = [],
}: ContractCallOptions): UseSorobanContractReturn {
```

`packages/core/src/hooks/useSorobanContract.ts:140-144`

```ts
  }, [contractId, method, args, networkConfig])

  useEffect(() => {
    callContract()
  }, [callContract])
```

Both `args` and `networkConfig` change identity every render:

- `args = []` allocates a new array whenever the caller omits the option — and a
  caller writing `args={[1, 2]}` inline allocates a new one too.
- `networkConfig` is rebuilt on every `StellarProvider` render because the
  provider's context value is not memoized (see **`bug-02`**,
  `StellarProvider.tsx:157-166`).

So: render → new `args`/`networkConfig` → new `callContract` → effect refires →
`setLoading`/`setData`/`setError` → re-render → new `args` → forever.

**Reproduced.** Mounting the hook with a valid `C…` contract id produced
**320,318 `simulateTransaction` calls across 480,477 renders in 8 async ticks**.
With an invalid contract id React throws `Maximum update depth exceeded` and the
Jest worker hangs until killed — which is why `pnpm test` never terminates today
(see **`test-02`**).

---

### Why this matters

Every consumer of this hook DoSes their own Soroban RPC endpoint on first render.
On a rate-limited public endpoint they are throttled within seconds; on a paid
provider they are billed for hundreds of thousands of calls; on a self-hosted node
they take it down. The hook is unusable as shipped in `use-stellar@0.1.5`, and
nothing in the docs warns about it.

It also blocks the whole test suite, which makes this a prerequisite for **`ci-01`**
(running tests in CI at all).

---

### Where this lives

- Hook: `packages/core/src/hooks/useSorobanContract.ts`
- Test: `packages/core/src/hooks/useSorobanContract.test.ts`
- Types: `packages/core/src/types/index.ts` (`ContractCallOptions`)

---

### Implementation guidelines

- **Key the callback on a stable serialization of `args`, not the array
  identity.** Compute a stable key once per render and use _that_ in the
  dependency array:

  ```ts
  const argsKey = useMemo(
    () => args.map(a => (a instanceof xdr.ScVal ? a.toXDR("base64") : JSON.stringify(a))).join("|"),
    [args] // recomputes every render, but produces a stable *string*
  )
  // …
  }, [contractId, method, argsKey, networkConfig.sorobanUrl, networkConfig.network])
  ```

  `xdr.ScVal` instances have no useful `JSON.stringify` output — serialize them
  through `toXDR("base64")`, which is exactly what the existing `toScVal` path
  already produces.

- **Keep a ref to the live `args` array** so the callback body still reads the
  real values while the dependency list only sees the key. Reading a ref inside
  an async callback is safe; reading it during render is not.
- **Depend on `networkConfig` fields, not the object.** Even after `bug-02` lands,
  depending on the primitive `sorobanUrl` and `network` strings is strictly safer.
- **Do not** "fix" this by removing `callContract` from the effect's dependency
  array or by adding an `eslint-disable` for `react-hooks/exhaustive-deps`. That
  hides the loop instead of removing it and will be rejected in review.
- Add a JSDoc note on the hook telling callers that non-primitive `args` should be
  memoized on their side, and that `xdr.ScVal[]` is the preferred input.
- Land alongside **`bug-02`** if you can — the two halves of the loop are the
  unmemoized provider value and the unstable `args`. Fixing only one leaves the
  hook re-simulating far more than necessary.

---

### Acceptance criteria

- [ ] Mounting the hook once calls `simulateTransaction` **exactly once** after the
      state settles
- [ ] Re-rendering the parent 5× with an inline `args={[1, 2]}` literal still
      results in exactly one `simulateTransaction` call
- [ ] Changing `contractId`, `method`, or the _value_ of `args` does trigger
      exactly one new call
- [ ] An invalid contract id sets `error` once and does not re-render in a loop
- [ ] `useSorobanContract.test.ts` completes in under 5 seconds and no longer hangs
- [ ] No `eslint-disable react-hooks/exhaustive-deps` added anywhere in the file
- [ ] JSDoc documents the memoization contract for callers
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

- The hook: `packages/core/src/hooks/useSorobanContract.ts`
- The other half of the loop: `packages/core/src/context/StellarProvider.tsx:157-166`
  (issue `bug-02`)
- A hook that already guards its async state correctly:
  `packages/core/src/hooks/useBalance.ts:54-99`
- Soroban RPC `simulateTransaction`: https://developers.stellar.org/docs/data/rpc/api-reference/methods/simulateTransaction
- React `useCallback` identity rules: https://react.dev/reference/react/useCallback

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
