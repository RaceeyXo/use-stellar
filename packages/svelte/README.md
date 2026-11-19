# @use-stellar/svelte

Svelte 5 runes for the Stellar network, built on [`use-stellar`](https://www.npmjs.com/package/use-stellar).

> **Status: scaffold.** This package sets up the build, packaging and test pipeline. The runes themselves (balances, Soroban reads, payments, wallet) arrive in follow-up releases, so there is no usable API yet.

The adapter is a thin layer over the React-free `use-stellar/core` entry (query store, fetchers, actions, wallet registry, errors), exactly as [`@use-stellar/vue`](../vue) is. React is never loaded.

## Installation

```bash
npm install @use-stellar/svelte use-stellar svelte
```

`use-stellar` and `svelte` (5 or later) are peer dependencies: your app has one copy of each, shared with anything else that uses them.

## Development

```bash
pnpm --filter @use-stellar/svelte build        # svelte-package: ESM + .d.ts into dist/
pnpm --filter @use-stellar/svelte test
pnpm --filter @use-stellar/svelte typecheck
pnpm --filter @use-stellar/svelte lint
pnpm --filter @use-stellar/svelte lint:package # publint, run after build
pnpm --filter @use-stellar/svelte size         # run after build
```

The build uses [`@sveltejs/package`](https://svelte.dev/docs/kit/packaging), which turns `.svelte.ts` files into `.svelte.js` and emits type declarations. The runes inside are left for your app's Svelte compiler, as usual for Svelte libraries. Tests live in `test/`, outside `src/`, so they are never packaged. Relative imports inside `src/` need an explicit `.js` extension, because the output is native ESM.

## License

Apache-2.0
