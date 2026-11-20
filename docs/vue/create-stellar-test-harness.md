# createStellarTestHarness

Provides a Stellar runtime to composables in tests, with no component tree, no DOM and no `@vue/test-utils`.

## Installation

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Import

It lives in its own entry point, so test scaffolding never reaches a production bundle:

```ts
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"
```

## Basic usage

```ts
import { afterEach, expect, it } from "vitest"
import { useBalance } from "@use-stellar/vue"
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"

const harness = createStellarTestHarness({ network: "testnet" })
afterEach(() => harness.dispose())

it("starts idle without an address", () => {
  const { balance, loading } = harness.run(() => useBalance({ address: null }))
  expect(balance.value).toBeNull()
  expect(loading.value).toBe(false)
})
```

## Parameters

`createStellarTestHarness(options?)` takes the same options as [`createStellarPlugin`](./create-stellar-plugin.md#parameters):

| Parameter       | Type                                                     | Required | Default        | Description                                       |
| --------------- | -------------------------------------------------------- | -------- | -------------- | ------------------------------------------------- |
| `network`       | `"testnet" \| "mainnet" \| "futurenet"`                  | No       | `"testnet"`    | The network the runtime is built for.             |
| `networkConfig` | `Partial<{ horizonUrl; sorobanUrl; networkPassphrase }>` | No       | Built-in URLs  | Overrides the endpoints for `network`.            |
| `queryConfig`   | `QueryConfig`                                            | No       | Cache defaults | Cache settings, such as `staleTime` and `gcTime`. |
| `walletAddress` | `string \| null`                                         | No       | `null`         | An initial wallet address.                        |

## Return values

| Property  | Type                    | Description                                                                                       |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `app`     | `App`                   | The throwaway Vue app the runtime is provided to.                                                 |
| `runtime` | `StellarRuntime`        | The exact runtime every composable in `run()` reads through. Use it to seed or inspect the cache. |
| `run`     | `<T>(fn: () => T) => T` | Runs `fn` with the runtime available to `inject()`, inside a disposable effect scope.             |
| `dispose` | `() => void`            | Stops the effect scope, tearing down every watcher and computed created by `run()`.               |

## Examples

### Example 1 - the common case

```ts
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"
import { useBalance } from "@use-stellar/vue"

const harness = createStellarTestHarness()
const { loading } = harness.run(() => useBalance({ address: null }))
// ...assert...
harness.dispose()
```

### Example 2 - seeding a wallet

`walletAddress` sets the address read composables fall back to, with no wallet connection.

```ts
import { createStellarTestHarness } from "@use-stellar/vue/test-utils"
import { useClaimableBalance } from "@use-stellar/vue"

const harness = createStellarTestHarness({
  walletAddress: "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS",
})
const { balances } = harness.run(() => useClaimableBalance())
```

### Example 3 - a fresh harness for every test

Each harness has its own cache, so tests cannot leak data into each other.

```ts
import { afterEach, beforeEach } from "vitest"
import { createStellarTestHarness, type StellarTestHarness } from "@use-stellar/vue/test-utils"

let harness: StellarTestHarness

beforeEach(() => {
  harness = createStellarTestHarness({ queryConfig: { staleTime: 0 } })
})

afterEach(() => harness.dispose())
```

## TypeScript

```ts
interface StellarTestHarness {
  app: App
  runtime: StellarRuntime
  run: <T>(fn: () => T) => T
  dispose: () => void
}

function createStellarTestHarness(options?: StellarPluginOptions): StellarTestHarness
```

## Common errors

| Error                                   | Cause                                     | Fix                                                  |
| --------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `@use-stellar/vue: no plugin installed` | A composable ran outside `harness.run()`. | Wrap the call: `harness.run(() => useBalance(...))`. |
| Watchers keep running between tests     | `dispose()` was never called.             | Call `harness.dispose()` in `afterEach`.             |

## Notes

- `run()` uses `app.runWithContext()` (Vue 3.3 or later) so `inject()` resolves outside a component's `setup()`.
- Composables that call `onScopeDispose` are cleaned up by `dispose()`, because `run()` creates them inside an effect scope.
- Network access is not mocked. Mock `@stellar/stellar-sdk` or the fetch layer in your own tests.

## Differences from React

React tests wrap a hook in a `StellarProvider` through a rendering helper. In Vue the harness provides the runtime to a bare app, so no rendering is needed.

## Related hooks

- [`createStellarPlugin`](./create-stellar-plugin.md) - the production counterpart that builds the same runtime.
