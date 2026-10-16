// packages/vue/src/index.ts — Vue 3 composables for the Stellar network.

export {
  createStellarPlugin,
  createStellarRuntime,
  useStellarRuntime,
  STELLAR_RUNTIME_KEY,
} from "./plugin"
export type { StellarPluginOptions, StellarRuntime } from "./plugin"

export { useBalance } from "./useBalance"
export type { UseBalanceOptions, UseBalanceReturn, MaybeRefOrGetter } from "./useBalance"

export { useAddTrustline } from "./useAddTrustline"
export type { UseAddTrustlineReturn } from "./useAddTrustline"
export type { AddTrustlineOptions } from "use-stellar/core"

export { usePathPayment } from "./usePathPayment"
export type { UsePathPaymentReturn } from "./usePathPayment"
export type { PathPaymentOptions } from "use-stellar/core"

export { VueQueryStore } from "./store"
export type { QueryStoreConfig, QueryEntry, RunOptions } from "./store"

export { accountKey } from "./keys"

export { NETWORK_CONFIGS } from "./types"
export type { StellarNetwork, NetworkConfig, Asset, Balance } from "./types"
