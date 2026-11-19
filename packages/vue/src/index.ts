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

export { useSorobanContract, ANONYMOUS_SIMULATION_SOURCE } from "./useSorobanContract"
export type { UseSorobanContractOptions, UseSorobanContractReturn } from "./useSorobanContract"
export { useContractEvents } from "./useContractEvents"
export type { UseContractEventsOptions, UseContractEventsReturn } from "./useContractEvents"
export { useSendPayment } from "./useSendPayment"
export type { UseSendPaymentReturn } from "./useSendPayment"
export type { SendPaymentOptions, SendPaymentResult } from "use-stellar/core"
export { useAddTrustline } from "./useAddTrustline"
export type { UseAddTrustlineReturn } from "./useAddTrustline"
export type { AddTrustlineOptions } from "use-stellar/core"

export { usePathPayment } from "./usePathPayment"
export type { UsePathPaymentReturn } from "./usePathPayment"
export type { PathPaymentOptions } from "use-stellar/core"
export { useClaimableBalance } from "./useClaimableBalance"
export type { UseClaimableBalanceOptions, UseClaimableBalanceReturn } from "./useClaimableBalance"

export { usePayments } from "./usePayments"
export type { UsePaymentsOptions, UsePaymentsReturn } from "./usePayments"

export { usePaymentHistory } from "./usePaymentHistory"
export type { UsePaymentHistoryOptions, UsePaymentHistoryReturn } from "./usePaymentHistory"

export { VueQueryStore } from "./store"
export type { QueryStoreConfig, QueryEntry, RunOptions } from "./store"

export { accountKey, claimableBalanceKey, paymentsKey } from "./keys"

export { NETWORK_CONFIGS } from "./types"
export type { StellarNetwork, NetworkConfig, Asset, Balance } from "./types"
