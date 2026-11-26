# @use-stellar/svelte

Svelte adapter for [use-stellar](https://github.com/RaceeyXo/use-stellar). It is built, tested, size-checked, and released with the Vue and React Native packages. The packed tarball does not load React.

Examples use the testnet network only.

```ts
import { createStellarSvelte } from "@use-stellar/svelte"

const stellar = createStellarSvelte({ network: "testnet" })
```

See [docs/svelte/getting-started.md](../../docs/svelte/getting-started.md).
