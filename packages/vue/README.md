# @use-stellar/vue

Vue 3 composables for the Stellar network, built on [`use-stellar`](https://www.npmjs.com/package/use-stellar).

The composables return Vue refs and clean up with their effect scope. Everything underneath — Horizon and Soroban fetchers, transaction building, fee policy, error codes, the query cache — is the same React-free code the React hooks use, imported from `use-stellar/core`. React is never loaded.

## Installation

```bash
npm install @use-stellar/vue use-stellar vue
```

`use-stellar` and `vue` (3.3 or later) are peer dependencies: your app has one copy of each, shared with anything else that uses them.

Install the SDK of the wallet you will sign with, exactly as for the React package — for example `npm install @stellar/freighter-api`. See [Supported wallets](https://github.com/RaceeyXo/use-stellar/tree/main/packages/core#supported-wallets).

## Quick start

Install the plugin once. It defaults to testnet.

```ts
// main.ts
import { createApp } from "vue"
import { createStellarPlugin } from "@use-stellar/vue"
import App from "./App.vue"

createApp(App)
  .use(createStellarPlugin({ network: "testnet" }))
  .mount("#app")
```

Then use the composables in any component:

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useBalance } from "@use-stellar/vue"

const address = ref("G...")
const { balance, loading, error } = useBalance({ address })
</script>

<template>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error">{{ error.message }}</p>
  <p v-else>{{ balance }} XLM</p>
</template>
```

Every option accepts a plain value, a ref, or a getter, and changes are picked up reactively.

### Plugin options

| Option          | Default                                  | Description                                                                  |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `network`       | `"testnet"`                              | `"testnet"`, `"mainnet"` or `"futurenet"`.                                   |
| `networkConfig` | —                                        | Override `horizonUrl`, `sorobanUrl` or `networkPassphrase` for that network. |
| `queryConfig`   | `{ staleTime: 30_000, gcTime: 300_000 }` | Cache timings in milliseconds, shared by every composable.                   |
| `walletAddress` | `null`                                   | The address read composables default to when given none.                     |

## Composables

### Reading

```ts
// XLM, or any asset with `asset: { code, issuer }`
const { balance, balances, loading, error, refetch } = useBalance({ address })

// Claimable balances; defaults to the runtime's wallet address
const { balances } = useClaimableBalance({ address })

// Paginated payments
const { payments, hasNext, fetchNext } = usePayments({ address, limit: 20 })

// The same, filtered on Horizon by direction and asset
const { payments: received } = usePaymentHistory({ address, direction: "incoming" })

// Read-only Soroban contract call, simulated
const { data } = useSorobanContract<number>({ contractId: "C...", method: "get_count" })

// Poll a contract's events
const { events, latestLedger } = useContractEvents({ contractIds: ["C..."] })
```

Requests are deduplicated and cached per app: two components asking for the same account share one request. `useBalance` accepts `maxRetries` (default 3) for rate limits.

### Writing

```ts
const { send, loading, error, result } = useSendPayment()
await send({ to: "G...", asset: "XLM", amount: "10" })

const { addTrustline } = useAddTrustline()
await addTrustline({ asset: { code: "USDC", issuer: "G..." } })

const { pathPayment } = usePathPayment()
await pathPayment({
  mode: "strictSend",
  destination: "G...",
  sendAsset: "XLM",
  sendAmount: "100",
  destAsset: { code: "USDC", issuer: "G..." },
  destMin: "24.75",
})
```

Validation, fee policy, the network check, signing and cache invalidation are the core actions the React hooks use, so behaviour and error codes are identical.

### Connecting a wallet

This release has no `useWallet` composable yet. The write composables sign with the wallet set on the runtime, so connect through a core wallet adapter and hand the result to the runtime:

```ts
import { freighterAdapter, getWalletAdapter, registerWalletAdapter } from "use-stellar/core"
import { useStellarRuntime } from "@use-stellar/vue"

// Once, at startup. `use-stellar/core` registers no browser wallets itself.
registerWalletAdapter(freighterAdapter, { override: true })

const runtime = useStellarRuntime() // inside setup()

async function connect() {
  const adapter = getWalletAdapter("freighter")
  const connection = await adapter.connect(runtime.network)
  runtime.setWallet({
    connected: true,
    connecting: false,
    address: connection.address,
    network: runtime.network,
    wallet: connection.wallet,
    walletName: adapter.metadata.name,
    error: null,
    walletNetwork: connection.network,
    walletNetworkPassphrase: connection.networkPassphrase,
  })
}
```

`setWallet` also sets the address the read composables default to. Register each wallet you offer the same way: `freighterAdapter` and `rabetAdapter` are exported from `use-stellar/core`, `createWalletConnectAdapter` creates a WalletConnect adapter, and any object implementing the `WalletAdapter` contract works.

## Nuxt

A Nuxt module is included. It installs the runtime and, on the client, can restore the previous wallet session:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@use-stellar/vue/nuxt"],
  runtimeConfig: {
    public: {
      stellar: {
        network: "testnet",
        autoConnect: true, // or { enabled: true, storage: "session" }
      },
    },
  },
})
```

The settings are read from `runtimeConfig.public.stellar`, so they can also come from environment variables in the usual Nuxt way.

Session restore never prompts: it reconnects only when the wallet allows a silent reconnect, and otherwise just remembers which wallet was used. Nothing is fetched during server rendering.

## Testing

`@use-stellar/vue/test-utils` gives a composable a runtime without mounting a component:

```ts
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"
import { useBalance } from "@use-stellar/vue"

const harness = createStellarTestHarness({ network: "testnet" })
const { balance } = harness.run(() => useBalance({ address: "G..." }))

// ...assert...

harness.dispose() // tears down every watcher created inside run()
```

Mock `@stellar/stellar-sdk`'s `Horizon.Server` in tests rather than calling the network.

## Errors

Every `error` ref holds a typed `StellarError` with a stable `code` (`ACCOUNT_NOT_FOUND`, `RATE_LIMITED`, `WALLET_NOT_CONNECTED`, `TX_TIMEOUT`, …) and a readable `message` — the same codes as the React package. See the [error-code table](https://github.com/RaceeyXo/use-stellar/tree/main/packages/core#error-codes).

## License

[Apache-2.0](https://github.com/RaceeyXo/use-stellar/blob/main/LICENSE)
