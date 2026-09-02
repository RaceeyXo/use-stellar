# Contributing to use-stellar

Thank you for your interest in contributing. This project is designed to be easy to contribute to — if you know React and TypeScript, you can add a hook, improve an existing one, write tests, or fix a bug without any blockchain or Stellar expertise.

---

## Branch strategy

- **`dev`** is the default branch and the base for all contributions. Branch off `dev`, and open your pull request against `dev`.
- **`main`** is production-only — it only ever moves via a release merge from `dev` (see [Releases](#releases) below). Never branch off `main` or target it directly with a feature/fix PR.

```bash
git checkout dev
git pull --rebase origin dev
git checkout -b your-feature-branch
```

---

## What kind of contributions are welcome

- **New hooks** — the most impactful contribution. See the list of open hook issues.
- **New wallet support** — add Albedo, Rabet, xBull, or any other Stellar wallet to `useWallet`.
- **Tests** — unit and integration tests for any hook.
- **Bug fixes** — anything labelled `bug`.
- **Demo pages** — add or improve the live demo for a hook.
- **Documentation** — improve the README, add JSDoc to hooks, or fix typos.

---

## Setup

### Requirements

- Node.js 20+
- pnpm (We use pnpm workspaces)

No Rust, no Stellar CLI, no wallet required to run tests or work on most hooks.

### Clone and install

```bash
git clone https://github.com/YOUR_HANDLE/use-stellar
cd use-stellar
git checkout dev
pnpm install
```

### Run the test suite

```bash
pnpm test
```

### Run package smoke tests

Verify the published package imports and type resolution integrity locally:

```bash
pnpm test:package
```

### Run the demo app

```bash
pnpm dev
```

Open `http://localhost:3000`. The demo shows every hook with a live output panel.

> **Note:** `pnpm dev` automatically builds the library first, so it works from a fresh clone with no prior build step required.

To test hooks that require a wallet (like `useWallet` and `useSendPayment`), install the [Freighter browser extension](https://freighter.app) and set it to Stellar testnet.

---

## Code quality

This project uses Husky to enforce code quality automatically.

Before every commit — Prettier formats your staged files and ESLint checks
them. If either fails your commit is blocked. Fix the errors and try again.

Before every push — the following checks run automatically. If any fails,
your push is blocked:

- **Format check** — `pnpm format:check`
- **Lint** — `pnpm lint`
- **Type check** — `pnpm typecheck`
- **SDK build** — `pnpm build`

Note: tests are not run by the pre-push hook. Run `pnpm test` manually before
pushing, or they will only be caught in CI.
Before every push — the SDK is built and the unit test suite is run. If either fails
your push is blocked.

To run checks manually at any time:

```bash
pnpm format       # format all files
pnpm lint         # run ESLint
pnpm typecheck    # run TypeScript compiler check
pnpm test         # run the test suite
pnpm lint         # run ESLint (core + demo)
pnpm typecheck    # run TypeScript compiler check (core + demo)
pnpm build:lib    # build the library only (without the demo)
pnpm build        # build the library and the demo
```

---

## Adding a new hook

This is the most common contribution and follows a clear pattern.

### 1. Create the hook file

```
packages/core/src/hooks/useYourHook.ts
```

Follow the pattern of an existing hook like `useBalance.ts`:

```typescript
import { useState, useEffect } from "react"
import { useStellarContext } from "../context/StellarProvider"

export interface UseYourHookReturn {
  data: SomeType | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useYourHook(): UseYourHookReturn {
  const { network } = useStellarContext()
  const [data, setData] = useState<SomeType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetch() {
    setLoading(true)
    try {
      // your logic here
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
  }, [network])

  return { data, loading, error, refetch: fetch }
}
```

### 2. Export from the index

Add to `packages/core/src/index.ts`:

```typescript
export { useYourHook } from "./hooks/useYourHook"
```

### 3. Add types if needed

Add any new interfaces to `packages/core/src/types/index.ts`.

### 4. Write tests

Create `packages/core/src/hooks/useYourHook.test.ts`. Test the logic you can unit test — particularly any utility functions. For hooks that call Horizon, mock the server response.

### 5. Add a demo page

Create `packages/demo/app/demo/your-hook/page.tsx` using the `DemoCard` component. See `app/demo/balance/page.tsx` as a reference.

### 6. Add it to the demo home page

Add your hook to the `hooks` array in `packages/demo/app/page.tsx`.

---

## Adding wallet support

Wallets are added in `packages/core/src/hooks/useWallet.ts`.

1. Add the wallet name to the `WalletType` union in `packages/core/src/types/index.ts`
2. Add a `connectYourWallet()` function in `useWallet.ts` — see `connectFreighter()` as a reference
3. Add a case to the `connect` function that calls your connector
4. Test it on Stellar testnet

---

## Pull request checklist

- [ ] PR targets `dev`, not `main`
- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] New hook is exported from `packages/core/src/index.ts`
- [ ] New hook has a demo page
- [ ] PR references the relevant issue (`Closes #N`)

---

## Commit style

Keep it simple and descriptive:

```
add usePaymentHistory hook
fix: useBalance not updating on address change
test: add useAccount unit tests
docs: add useSendPayment example to README
```

---

## Releases

`main` only moves via a release — never push or merge feature work into it directly. Releases are automated via `.github/workflows/release.yml`, which triggers on version tags (`v*.*.*`) regardless of branch, but tags should always be cut from `main`.

To publish a new version:

1. Open a PR merging `dev` into `main` once `dev` is in a release-ready state.
2. Update `CHANGELOG.md` — move items from `[Unreleased]` to a new versioned section, e.g. `## [0.2.0] - 2026-06-24`.
3. Bump the version in `packages/core/package.json`.
4. Merge into `main`, then tag the resulting commit:

```bash
git checkout main
git pull origin main
git tag v0.2.0
git push origin v0.2.0
```

The workflow will automatically:

- Run tests and build
- Publish `packages/core` to npm (requires `NODE_AUTH_TOKEN` secret set in repository settings)
- Create a GitHub Release with the changelog notes for that version

---

## Need help?

Open a [GitHub Discussion](../../discussions) or comment on the issue you are working on. No question is too basic.
