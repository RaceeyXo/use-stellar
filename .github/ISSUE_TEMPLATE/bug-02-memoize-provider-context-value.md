---
name: "Bug 02: Memoize the StellarProvider context value"
about: The provider rebuilds its context value on every render, re-rendering every consumer
title: "fix(core): memoize StellarProvider context value"
labels: bug, critical, performance
---

## Memoize the `StellarProvider` context value

**Complexity:** Low (50 points)
**Estimated time:** a few hours

---

### Context

`StellarProvider` is the single source of truth for the network config and the
wallet state. Every hook in the library calls `useStellarContext()` to read it, so
the identity of that context value decides how often the entire consumer tree
re-renders.

React Context does **not** do structural comparison. It compares the `value` prop
with `Object.is`. A fresh object literal on every render means every consumer
re-renders on every provider render, no matter whether anything actually changed.

This is a four-line fix that removes an entire class of downstream bug.

---

### The defect

`packages/core/src/context/StellarProvider.tsx:149-169`

```tsx
export function StellarProvider({
  network = "testnet",
  networkConfig: networkConfigOverride,
  children,
}: StellarProviderProps) {
  const resolvedNetworkConfig = resolveNetworkConfig(network, networkConfigOverride)

  const [wallet, setWallet] = useState<WalletState>(DEFAULT_WALLET)

  const value: StellarContextValue = {
    network,
    networkConfig: resolvedNetworkConfig,
    wallet,
    setWallet,
  }

  return <StellarContext.Provider value={value}>{children}</StellarContext.Provider>
}
```

Two problems:

1. `resolveNetworkConfig` re-runs unmemoized on every render and returns a **new
   `NetworkConfig` object** whenever an override is supplied (see the object
   literal at `StellarProvider.tsx:74-78`).
2. `value` is a fresh object literal on every render regardless.

---

### Why this matters

- Every `setWallet` call re-renders every consumer of every hook in the tree, even
  components that only read `network`.
- The churning `networkConfig` identity is **half of `bug-01`'s infinite render
  loop** — it is a dependency of `useSorobanContract`'s `useCallback` at
  `useSorobanContract.ts:140`.
- It makes `send` unstable: `useSendPayment.ts:124` lists `networkConfig` in its
  dependency array, so `send` gets a new identity on every provider render. Any
  consumer with `useEffect(..., [send])` loops.

---

### Where this lives

- Provider: `packages/core/src/context/StellarProvider.tsx`
- Test: `packages/core/src/context/StellarProvider.test.tsx`

---

### Implementation guidelines

- Wrap `resolveNetworkConfig` in `useMemo`, keyed on **primitives**, not the
  override object (a caller passing an inline `networkConfig={{ … }}` literal
  would otherwise defeat the memo):

  ```ts
  const resolvedNetworkConfig = useMemo(
    () => resolveNetworkConfig(network, networkConfigOverride),
    [network, networkConfigOverride?.horizonUrl, networkConfigOverride?.sorobanUrl]
  )
  ```

- Wrap `value` in `useMemo` on `[network, resolvedNetworkConfig, wallet]`.
  `setWallet` comes from `useState` and is already referentially stable — it does
  not belong in the dependency list, but including it is harmless.
- **Preserve the throw-on-render behaviour.** `resolveNetworkConfig` throws
  synchronously on a half-filled `networkConfig` (`StellarProvider.tsx:58-72`), and
  the existing tests assert this. `useMemo` runs during render, so the throw still
  surfaces in the same place — verify, do not assume.
- Do not convert the provider to `useReducer` or restructure the state. Keep this
  change to exactly the two `useMemo` calls.

---

### Acceptance criteria

- [ ] `resolveNetworkConfig` is memoized on primitive dependencies
- [ ] The context `value` is memoized
- [ ] A test asserts the context value identity is **unchanged** across a parent
      re-render with unchanged props
- [ ] A test asserts the identity **does** change when `network` changes
- [ ] The provider still throws synchronously on an invalid `networkConfig` —
      existing `StellarProvider.test.tsx` behaviour preserved
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

- The provider: `packages/core/src/context/StellarProvider.tsx`
- Downstream victim #1: `packages/core/src/hooks/useSorobanContract.ts:140` (issue `bug-01`)
- Downstream victim #2: `packages/core/src/hooks/useSendPayment.ts:124`
- React Context re-render semantics: https://react.dev/reference/react/useContext#optimizing-re-renders

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
