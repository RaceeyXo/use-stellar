// packages/vue/src/test-utils.ts
//
// A reusable harness for testing this package's composables without a real
// component tree: no DOM, no @vue/test-utils, no mounted app.
//
// Two Vue primitives make this possible together:
//  - `app.runWithContext(fn)` (Vue 3.3+) lets `inject()` resolve against the
//    app's provided values from outside a component's `setup()`.
//  - `effectScope()` gives every `watchEffect`/`computed` a lifecycle to
//    belong to, so `dispose()` actually tears them down — `runWithContext`
//    alone does not do this, since it only sets the injection context.
//
// Exported from a separate `@use-stellar/vue/test-utils` entry point so
// `effectScope`/`createApp` test scaffolding never ends up in a consumer's
// production bundle just because they imported the main package.

import { createApp, effectScope, type App, type EffectScope } from "vue"
import { STELLAR_RUNTIME_KEY, createStellarRuntime } from "./plugin"
import type { StellarPluginOptions, StellarRuntime } from "./plugin"

export interface StellarTestHarness {
  app: App
  /** The exact runtime instance provided to the app — same `QueryStore` every composable in `run()` reads through. */
  runtime: StellarRuntime
  /** Runs `fn` with the runtime available to `inject()` / composables, inside a disposable effect scope. */
  run: <T>(fn: () => T) => T
  /** Stops the effect scope, tearing down every watcher/computed created via `run()`. Call in `afterEach`. */
  dispose: () => void
}

/**
 * Mounts a throwaway Vue app with the Stellar plugin installed, for testing
 * composables that call `useStellarRuntime()` — directly, or through
 * `useBalance` and friends — with no real component tree.
 *
 * @example
 * const harness = createStellarTestHarness({ network: "testnet" })
 * const { balance } = harness.run(() => useBalance({ address: "GABC..." }))
 * // ...assert...
 * harness.dispose()
 */
export function createStellarTestHarness(options: StellarPluginOptions = {}): StellarTestHarness {
  const runtime = createStellarRuntime(options)
  const app = createApp({})
  app.provide(STELLAR_RUNTIME_KEY, runtime)

  const scope: EffectScope = effectScope()

  function run<T>(fn: () => T): T {
    return scope.run(() => app.runWithContext(fn)) as T
  }

  return {
    app,
    runtime,
    run,
    dispose: () => scope.stop(),
  }
}
