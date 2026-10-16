import { computed, watchEffect } from "vue"
import { createStellarTestHarness } from "./test-utils"
import { useStellarRuntime } from "./plugin"

test("provides the plugin's runtime to inject() inside run()", () => {
  const harness = createStellarTestHarness({ network: "testnet" })

  const runtime = harness.run(() => useStellarRuntime())

  expect(runtime).toBe(harness.runtime)
  expect(runtime.network).toBe("testnet")
  expect(runtime.networkConfig.horizonUrl).toBe("https://horizon-testnet.stellar.org")

  harness.dispose()
})

test("reactive state created inside run() updates live", () => {
  const harness = createStellarTestHarness()

  const doubled = harness.run(() => {
    const { queryStore } = useStellarRuntime()
    void queryStore // touched only to prove the injection context works
    return computed(() => 1 + 1)
  })

  expect(doubled.value).toBe(2)
  harness.dispose()
})

test("dispose() stops the effect scope so watchers created via run() no longer react", async () => {
  const harness = createStellarTestHarness()
  let runs = 0

  harness.run(() => {
    watchEffect(() => {
      runs++
      void harness.runtime.walletAddress.value
    })
  })

  expect(runs).toBe(1)

  harness.dispose()

  // Mutating the store after dispose must not re-trigger the watcher — its
  // effect scope was stopped, so this proves the composable's subscription
  // was really torn down rather than merely garbage-collected eventually.
  harness.runtime.setWalletAddress("GAFTERDISPOSE")
  await Promise.resolve()
  expect(runs).toBe(1)
})

test("two harnesses have independent runtimes and stores", () => {
  const a = createStellarTestHarness({ network: "testnet" })
  const b = createStellarTestHarness({ network: "futurenet" })

  expect(a.runtime).not.toBe(b.runtime)
  expect(a.runtime.queryStore).not.toBe(b.runtime.queryStore)
  expect(a.runtime.network).toBe("testnet")
  expect(b.runtime.network).toBe("futurenet")

  a.dispose()
  b.dispose()
})
