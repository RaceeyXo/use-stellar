# createStellarPlugin

Installs the Stellar runtime on a Vue app: the resolved network configuration plus one query cache that every composable shares.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

```ts
import { createStellarPlugin, useStellarRuntime } from "@use-stellar/vue"
```

## Basic usage

```ts
import { createApp } from "vue"
import { createStellarPlugin } from "@use-stellar/vue"
import App from "./App.vue"

createApp(App)
  .use(createStellarPlugin({ network: "testnet" }))
  .mount("#app")
```

Install the plugin before mounting. Every composable in the package throws if no plugin is installed.

## Parameters

`createStellarPlugin(options?)` takes one optional object:

| Parameter       | Type                                                     | Required | Default       | Description                                                                       |
| --------------- | -------------------------------------------------------- | -------- | ------------- | --------------------------------------------------------------------------------- |
| `network`       | `"testnet" \| "mainnet" \| "futurenet"`                  | No       | `"testnet"`   | The network every composable reads and writes on.                                 |
| `networkConfig` | `Partial<{ horizonUrl; sorobanUrl; networkPassphrase }>` | No       | Built-in URLs | Overrides the endpoints for `network`. A field left out keeps its built-in value. |
| `queryConfig`   | `QueryConfig`                                            | No       | See below     | Cache settings shared by every composable.                                        |
| `walletAddress` | `string \| null`                                         | No       | `null`        | An initial wallet address, for example a restored client session.                 |

### `QueryConfig`

| Field       | Type     | Default          | Description                                                 |
| ----------- | -------- | ---------------- | ----------------------------------------------------------- |
| `staleTime` | `number` | `30000` (30 s)   | How long, in milliseconds, cached data counts as fresh.     |
| `gcTime`    | `number` | `300000` (5 min) | How long an entry is kept after its last subscriber leaves. |

## Return values

`createStellarPlugin` returns a Vue plugin: an object with an `install(app)` method. Installing it provides a `StellarRuntime`, which `useStellarRuntime()` returns:

| Property           | Type                                | Description                                                          |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------- |
| `network`          | `StellarNetwork`                    | The configured network.                                              |
| `networkConfig`    | `NetworkConfig`                     | The resolved `horizonUrl`, `sorobanUrl` and `networkPassphrase`.     |
| `queryStore`       | `QueryStore`                        | The one cache per app, shared by every composable.                   |
| `wallet`           | `WalletState`                       | The wallet connection the write composables sign with.               |
| `setWallet`        | `(wallet: WalletState) => void`     | Replaces the wallet state and keeps `walletAddress` in step with it. |
| `walletAddress`    | `Ref<string \| null>`               | The address read composables use when given none.                    |
| `setWalletAddress` | `(address: string \| null) => void` | Sets only the read address.                                          |

## Examples

### Example 1 - the common case

```ts
import { createApp } from "vue"
import { createStellarPlugin } from "@use-stellar/vue"
import App from "./App.vue"

createApp(App).use(createStellarPlugin()).mount("#app")
```

### Example 2 - custom endpoints and a shorter cache

```ts
import { createApp } from "vue"
import { createStellarPlugin } from "@use-stellar/vue"
import App from "./App.vue"

createApp(App)
  .use(
    createStellarPlugin({
      network: "testnet",
      networkConfig: { horizonUrl: "https://my-horizon.example.com" },
      queryConfig: { staleTime: 10_000 },
    })
  )
  .mount("#app")
```

### Example 3 - reading the runtime in a component

```vue
<script setup lang="ts">
import { useStellarRuntime } from "@use-stellar/vue"

const runtime = useStellarRuntime()
</script>

<template>
  <p>Network: {{ runtime.network }}</p>
  <p>Horizon: {{ runtime.networkConfig.horizonUrl }}</p>
</template>
```

## TypeScript

```ts
interface StellarPluginOptions {
  network?: StellarNetwork
  networkConfig?: Partial<Pick<NetworkConfig, "horizonUrl" | "sorobanUrl" | "networkPassphrase">>
  queryConfig?: QueryConfig
  walletAddress?: string | null
}

interface StellarRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  queryStore: QueryStore
  wallet: WalletState
  setWallet: (wallet: WalletState) => void
  walletAddress: Ref<string | null>
  setWalletAddress: (address: string | null) => void
}
```

## Common errors

| Error                                                                           | Cause                                                        | Fix                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `@use-stellar/vue: no plugin installed. Call app.use(createStellarPlugin())...` | A composable ran outside an app the plugin was installed on. | Call `app.use(createStellarPlugin())` first, and call composables during component setup. |

## Notes

- The runtime is built once per `app.use()` call, so each app gets its own cache.
- `wallet` is a plain property, not a ref. A template that reads `runtime.wallet` does not re-render when `setWallet` replaces it; `walletAddress` is the reactive part.
- `createStellarRuntime(options)` builds the same runtime without installing it. It is what the plugin and the test harness use.
- Nuxt apps get the runtime from the `@use-stellar/vue/nuxt` module instead of calling this.

## Differences from React

React wraps the tree in a `StellarProvider` component. Vue installs the plugin on the app, so there is nothing to wrap.

## Related hooks

- [`createStellarTestHarness`](./create-stellar-test-harness.md) - provides a runtime to composables in tests.
- [`useBalance`](./use-balance.md) - a composable that reads through this runtime.
