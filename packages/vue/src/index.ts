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
export { useLiquidityPool, useLiquidityPoolActions } from "./useLiquidityPool"
export type {
  UseLiquidityPoolOptions,
  UseLiquidityPoolReturn,
  UseLiquidityPoolActionsReturn,
} from "./useLiquidityPool"
export type {
  LiquidityPool,
  LiquidityPoolDepositOptions,
  LiquidityPoolWithdrawOptions,
} from "use-stellar/core"

export { useSorobanWrite } from "./useSorobanWrite"
export type { UseSorobanWriteReturn, SorobanWriteState } from "./useSorobanWrite"
export type { SorobanInvokeOptions } from "use-stellar/core"

export { useClaimableBalance } from "./useClaimableBalance"
export type { UseClaimableBalanceOptions, UseClaimableBalanceReturn } from "./useClaimableBalance"

export { usePaymentPaths } from "./usePaymentPaths"
export type { UsePaymentPathsReturn } from "./usePaymentPaths"
export type { UsePaymentPathsOptions, PaymentPath } from "use-stellar/core"
export { useAccountExists } from "./useAccountExists"
export type {
  UseAccountExistsOptions,
  UseAccountExistsReturn,
  AccountExistsReason,
} from "./useAccountExists"

export { useAsset } from "./useAsset"
export type { UseAssetOptions, UseAssetReturn, AssetInfo } from "./useAsset"

export { useTransaction } from "./useTransaction"
export type { UseTransactionOptions, UseTransactionReturn } from "./useTransaction"

export { usePayments } from "./usePayments"
export type { UsePaymentsOptions, UsePaymentsReturn } from "./usePayments"

export { usePaymentHistory } from "./usePaymentHistory"
export type { UsePaymentHistoryOptions, UsePaymentHistoryReturn } from "./usePaymentHistory"

export { useAnchor } from "./useAnchor"
export type { UseAnchorOptions, UseAnchorReturn } from "./useAnchor"
export { useOffers } from "./useOffers"
export type { UseOffersOptions, UseOffersReturn } from "./useOffers"
export { useOrderBook } from "./useOrderBook"
export type { UseOrderBookOptions, UseOrderBookReturn } from "./useOrderBook"
export { useStreamPayments } from "./useStreamPayments"
export type { UseStreamPaymentsOptions, UseStreamPaymentsReturn } from "./useStreamPayments"
export { useFriendBot } from "./useFriendBot"
export type { UseFriendBotReturn } from "./useFriendBot"
export { useSep10Auth } from "./useSep10Auth"
export type { UseSep10AuthOptions, UseSep10AuthReturn } from "./useSep10Auth"
export { useTrades } from "./useTrades"
export type { UseTradesOptions, UseTradesReturn } from "./useTrades"

export { useFeeStats } from "./useFeeStats"
export type { UseFeeStatsOptions, UseFeeStatsReturn, FeeUrgency } from "./useFeeStats"
export { useTransactionHistory } from "./useTransactionHistory"
export type {
  UseTransactionHistoryOptions,
  UseTransactionHistoryReturn,
} from "./useTransactionHistory"

export { VueQueryStore } from "./store"
export type { QueryStoreConfig, QueryEntry, RunOptions } from "./store"

export { accountKey, claimableBalanceKey, paymentsKey, tradesKey, feeStatsKey } from "./keys"

export { NETWORK_CONFIGS } from "./types"
export type { StellarNetwork, NetworkConfig, Asset, Balance } from "./types"

export { useCreateAccount } from "./useCreateAccount"
export type { UseCreateAccountReturn } from "./useCreateAccount"

export { useManageOffer, useManagerOffer } from "./useManagerOffer"
export type { UseManageOfferReturn } from "./useManagerOffer"
