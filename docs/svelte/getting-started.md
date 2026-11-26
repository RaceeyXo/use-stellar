# Svelte

`@use-stellar/svelte` is published from `packages/svelte`. CI lints, typechecks, tests, and size-limits it, and the release workflow (manual `workflow_dispatch`, same as Vue) packs it and checks that React is not installed.

## Example

Testnet only.

```ts
import { createStellarSvelte } from "@use-stellar/svelte"

const { network } = createStellarSvelte({ network: "testnet" })
```

`network` is `"testnet"`.
