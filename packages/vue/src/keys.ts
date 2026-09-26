// packages/vue/src/keys.ts
//
// Query key builders. Every composable that fetches the same underlying
// Horizon resource must build its key the same way, so they share one cache
// entry and one in-flight request instead of racing separate ones.

/** useBalance — and any future hook that calls server.loadAccount(). */
export function accountKey(horizonUrl: string, network: string, address: string): string {
  return JSON.stringify(["account", horizonUrl, network, address])
}
