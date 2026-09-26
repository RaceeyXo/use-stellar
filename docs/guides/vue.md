# Vue

`use-stellar` is a React library. Vue support ships as a **separate package**,
`@use-stellar/vue` — it imports nothing from `use-stellar` and does not pull
React into a Vue project. The two packages happen to live in the same
monorepo and follow the same design (one shared cache, one provider/plugin),
but they are independent at install time.

> **Status:** early. Only `useBalance` exists today. See the
> [Roadmap](../../README.md#roadmap) for what's next.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

`vue` is a peer dependency (`^3.3.0` — the plugin uses `app.runWithContext`,
added in 3.3). `@stellar/stellar-sdk` is bundled as a regular dependency, the
same way it is in the React package.

## 1. Install the plugin

Register `createStellarPlugin` on your Vue app, once, before any component
uses a composable from this package. By default it points at **testnet**.

```ts
// main.ts
import { createApp } from "vue"
import { createStellarPlugin } from "@use-stellar/vue"
import App from "./App.vue"

createApp(App).use(createStellarPlugin({ network: "testnet" })).mount("#app")
```

The plugin creates one shared query cache for the whole app — every
composable that reads the same address and network shares one in-flight
request, the same way every hook in the React package shares one
`StellarProvider`.

## 2. Read a balance

```vue
<script setup lang="ts">
import { useBalance } from "@use-stellar/vue"

const { balance, loading, error } = useBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
</script>

<template>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error">Something went wrong.</p>
  <p v-else>{{ balance ?? "0" }} XLM</p>
</template>
```

`address` also accepts a `ref` or a getter, so it can track a connected
wallet's address as it changes:

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useBalance } from "@use-stellar/vue"

const address = ref("GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS")
const { balance } = useBalance({ address })
</script>
```

Changing `address.value` unsubscribes from the old query and loads the new
one — the previous balance is not shown, even briefly, under the new address.

### An issued asset

```ts
const { balance } = useBalance({
  address: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
  asset: { code: "USDC", issuer: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV" },
})
```

## Testnet configuration

Point the plugin at a different network, or override individual endpoints:

```ts
app.use(
  createStellarPlugin({
    network: "testnet",
    queryConfig: { staleTime: 60_000 },
  })
)
```

Fund a testnet account with [Friendbot](https://friendbot.stellar.org) before
reading its balance — see [Networks](./networks.md) for details shared with
the React package.

## Testing composables

`@use-stellar/vue/test-utils` mounts a throwaway app with the plugin
installed, so you can call a composable without a real component tree:

```ts
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"
import { useBalance } from "@use-stellar/vue"

const harness = createStellarTestHarness({ network: "testnet" })
const { balance } = harness.run(() => useBalance({ address: "GABC..." }))

// ...assert...

harness.dispose() // tears down every watcher created inside run()
```

Mock `@stellar/stellar-sdk`'s `Horizon.Server` in your test, the same way the
React package's test suite does — never make a real network call in a test.

## Why a separate package

The React package's cache (`QueryStore`) and Horizon helpers are pure
TypeScript with no React import in their own module graph, but they live
inside the `use-stellar` package, which declares `react` as a required peer
dependency. Depending on that package from a Vue app — even just to reuse
`QueryStore` — would put a `react` peer-dependency warning in front of every
Vue user who installs it, the same installation friction the React Native
work fixed for `react-dom`. `@use-stellar/vue` re-implements the same design
(one shared, reactive cache; one plugin; one composable pattern) natively in
Vue instead, with zero React in its dependency tree.
