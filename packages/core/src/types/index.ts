import type { Dispatch, SetStateAction } from "react"
import type { StellarError } from "../errors"
import type { QueryStore } from "../cache"

export type { QueryConfig } from "../cache"

export type { StellarError, StellarErrorCode } from "../errors"
export type { AssetInfo, UseAssetOptions, UseAssetReturn } from "../hooks/useAsset"

/**
 * Represents the Stellar network environment.
 *
 * `"custom"` is any network this library ships no defaults for — a local
 * quickstart or standalone container, or a private deployment. It carries no
 * built-in endpoints or passphrase, so `networkConfig` must supply all three.
 */
export type StellarNetwork = "testnet" | "mainnet" | "futurenet" | "custom"

/**
 * Configuration details for a specific Stellar network.
 *
 * `networkPassphrase` is not decoration. It is mixed into the transaction hash
 * before signing, which is what binds a signature to one network — the same
 * envelope signed with the testnet passphrase is invalid on mainnet. Every
 * hook that builds a transaction reads it from here, so there is one source of
 * truth and no opportunity to sign against the wrong network.
 */
export interface NetworkConfig {
  network: StellarNetwork
  horizonUrl: string
  sorobanUrl: string
  networkPassphrase: string
}

/**
 * Override for Horizon / Soroban RPC endpoints, and for the network
 * passphrase.
 *
 * `networkPassphrase` is optional for the networks this library knows
 * (`testnet`, `mainnet`, `futurenet`) and **required** for `network="custom"`.
 * A custom network with no passphrase throws at provider render rather than
 * silently defaulting — signing against the wrong network must not be
 * reachable by accident.
 *
 * @example
 * // Private infrastructure or rate-limit avoidance:
 * <StellarProvider
 *   network="mainnet"
 *   networkConfig={{
 *     horizonUrl: "https://horizon.my-node.com",
 *     sorobanUrl: "https://rpc.my-node.com",
 *   }}
 * />
 *
 * @example
 * // A local standalone / quickstart container:
 * <StellarProvider
 *   network="custom"
 *   networkConfig={{
 *     horizonUrl: "http://localhost:8000",
 *     sorobanUrl: "http://localhost:8000/soroban/rpc",
 *     networkPassphrase: "Standalone Network ; February 2017",
 *   }}
 * />
 */
export interface CustomNetworkConfig {
  horizonUrl: string
  sorobanUrl: string
  networkPassphrase?: string
}

/**
 * The passphrase for each network this library ships defaults for.
 *
 * `custom` is deliberately absent — there is no such thing as a default
 * passphrase for a network we know nothing about.
 */
export const NETWORK_PASSPHRASES: Record<Exclude<StellarNetwork, "custom">, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
}

/**
 * The passphrase for a network, or `undefined` for `"custom"`.
 *
 * Use this rather than indexing {@link NETWORK_PASSPHRASES} directly: a custom
 * network genuinely has no known passphrase, and `undefined` says so instead
 * of handing back the wrong one.
 */
export function getNetworkPassphrase(network: StellarNetwork): string | undefined {
  return network === "custom" ? undefined : NETWORK_PASSPHRASES[network]
}

/**
 * Pre-defined configurations for the networks with published endpoints.
 *
 * `custom` has no entry: its endpoints and passphrase come from
 * `networkConfig`, and the provider throws if they are missing.
 */
export const NETWORK_CONFIGS: Record<Exclude<StellarNetwork, "custom">, NetworkConfig> = {
  testnet: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  },
  mainnet: {
    network: "mainnet",
    horizonUrl: "https://horizon.stellar.org",
    sorobanUrl: "https://soroban.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.mainnet,
  },
  futurenet: {
    network: "futurenet",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    sorobanUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.futurenet,
  },
}

/**
 * Supported wallet providers.
 *
 * The built-in types keep autocomplete, while `(string & {})` lets an
 * application or a wallet vendor register its own adapter with
 * `registerWalletAdapter()` and pass that type to `connect()`.
 */
export type WalletType = "freighter" | "lobstr" | "albedo" | "rabet" | (string & {})

/**
 * The network a wallet reports it is currently on.
 *
 * `"custom"` means the wallet reported a passphrase this library ships no
 * configuration for — a private or standalone network. It is a value, not an
 * error: the wallet is simply somewhere the app does not recognise, which
 * `isNetworkMismatch` reports as a mismatch.
 */
export type WalletNetworkId = StellarNetwork

/**
 * The current state of the wallet connection.
 */
export interface WalletState {
  connected: boolean
  connecting: boolean
  address: string | null
  network: StellarNetwork | null // Network from provider config
  wallet: WalletType | null
  error: StellarError | null
  walletNetwork: WalletNetworkId | null // Actual network from wallet extension
  walletName: string | null
  /**
   * Raw passphrase reported by the wallet, present when `walletNetwork` is
   * set. Optional so existing code that builds a `WalletState` by hand keeps
   * compiling.
   */
  walletNetworkPassphrase?: string | null
}

/**
 * Represents the native Stellar asset (XLM).
 */
export type NativeAsset = "XLM"

/**
 * Represents a custom issued asset on the Stellar network.
 */
export interface IssuedAsset {
  code: string
  issuer: string
}

export interface LiquidityPoolAsset {
  asset: "liquidity_pool_shares"
  liquidityPoolId: string
}

/**
 * Extended asset information with validation metadata.
 */
export interface AssetMetadata extends IssuedAsset {
  verified: boolean
  timestamp: number
}

/**
 * Can be either a native asset or an issued asset.
 */
export type Asset = NativeAsset | IssuedAsset

/**
 * Represents a balance entry for an account.
 */
export type Balance =
  | {
      asset: "XLM"
      balance: string
    }
  | {
      asset: {
        code: string
        issuer: string
      }
      balance: string
      limit: string
    }
  | {
      asset: "liquidity_pool_shares"
      balance: string
      liquidityPoolId: string
    }

/**
 * Detailed account information from the Stellar network.
 */
export interface AccountInfo {
  address: string
  sequence: string
  balances: Balance[]
  subentryCount: number
  thresholds: {
    lowThreshold: number
    medThreshold: number
    highThreshold: number
  }
  signers: {
    key: string
    weight: number
    type: string
  }[]
}

/**
 * The current status of a transaction on the network.
 */
export type TransactionStatus = "pending" | "success" | "failed" | "not_found"

/**
 * Result details from a submitted or queried transaction.
 */
export interface TransactionResult {
  hash: string
  status: TransactionStatus
  ledger?: number
  createdAt?: string
  fee?: string
  envelope?: string
}

/**
 * Fee controls shared by every hook that builds a Horizon transaction.
 *
 * Stellar prices transactions by auction: each ledger has limited capacity,
 * and when more transactions are submitted than fit, the network takes the
 * highest bidders and rejects the rest with `tx_insufficient_fee`.
 *
 * **A fee is a maximum bid, not a charge.** The network only ever takes what
 * it needs to include your transaction, so bidding generously costs nothing in
 * the common case and is what keeps a transaction landing during congestion.
 */
export interface FeeOptions {
  /**
   * Explicit fee in stroops, per operation. Wins over everything else.
   *
   * @example
   * send({ to, asset: "XLM", amount: "10", fee: "10000" })
   */
  fee?: string
  /**
   * Multiplier applied to the network's current base fee, fetched from
   * Horizon at build time. Defaults to {@link DEFAULT_FEE_MULTIPLIER}.
   *
   * @example
   * send({ to, asset: "XLM", amount: "10", feeMultiplier: 10 })
   */
  feeMultiplier?: number
}

/** How aggressively {@link UseFeeStatsReturn.suggested} should bid. */
export type FeeUrgency = "low" | "normal" | "high"

export interface UseFeeStatsOptions {
  /** When true, re-fetch fee stats on an interval. Default false. */
  watch?: boolean
  /** Polling interval in ms when `watch` is true. Default 10000. */
  interval?: number
}

export interface UseFeeStatsReturn {
  /** `last_ledger_base_fee` from Horizon, in stroops. */
  baseFee: string
  /** Charged-fee percentiles from the last 5 ledgers, in stroops. */
  percentiles: Record<"p10" | "p50" | "p90" | "p95" | "p99", string>
  /**
   * True when `fee_charged.mode` is strictly greater than
   * `last_ledger_base_fee`. A quiet ledger keeps those two equal; any gap
   * means the most common inclusion fee beat the protocol floor.
   */
  isSurging: boolean
  /**
   * Returns a max fee bid in stroops. `"low"` → p50, `"normal"` (default) →
   * p90, `"high"` → p99 of `fee_charged`. Never a number.
   */
  suggested: (urgency?: FeeUrgency) => string
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => Promise<void>
}

/**
 * Options for sending a payment transaction.
 */
export interface SendPaymentOptions extends FeeOptions {
  to: string
  asset: Asset
  amount: string
  memo?: string
}

/**
 * Result returned after a payment is sent.
 */
export interface SendPaymentResult {
  hash: string
  status: TransactionStatus
}

/**
 * Options for adding a trustline to an asset.
 */
export interface AddTrustlineOptions extends FeeOptions {
  asset: IssuedAsset
  limit?: string
}

/**
 * Return value from the `useAddTrustline` hook.
 */
export interface UseAddTrustlineReturn {
  addTrustline: (options: AddTrustlineOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}

/**
 * A normalized payment record for display or processing.
 */
export interface NormalizedPayment {
  id: string
  txHash: string
  type: string
  from: string
  to: string
  amount: string
  asset: Asset
  direction: "incoming" | "outgoing"
  createdAt: string
}

/**
 * Options for calling a Soroban smart contract.
 */
export interface ContractCallOptions {
  contractId: string
  method: string
  /**
   * Call arguments. `xdr.ScVal` values are the primary path and pass through
   * untouched; a bare `number` or `string` is ambiguous in Soroban's type
   * system and is rejected with an error naming the XDR type to use.
   */
  args?: unknown[]
  /**
   * The contract's parsed spec. When supplied, arguments are converted against
   * the parameter types the contract itself declares, and the return value is
   * decoded against its declared return type.
   *
   * @example
   * const spec = new contract.Spec(specEntries)
   */
  spec?: ContractSpecLike
  /**
   * Account to simulate as. Defaults to the connected wallet address, then to
   * a documented placeholder when no wallet is connected.
   */
  sourceAccount?: string
}

/**
 * The subset of the SDK's `contract.Spec` this library uses.
 *
 * Declared structurally so consumers are not forced to line up SDK instance
 * types across package boundaries.
 */
export interface ContractSpecLike {
  funcArgsToScVals: (name: string, args: object) => unknown[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  funcResToNative: (name: string, val: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFunc: (name: string) => any
}

export interface ClaimableBalanceClaimant {
  destination: string
  predicate: object
}

export interface ClaimableBalance {
  id: string
  asset: string
  amount: string
  claimants: ClaimableBalanceClaimant[]
  sponsor?: string
}

/**
 * Options controlling whether a wallet session survives a page reload.
 *
 * Autoconnect is **off by default** — enabling it is an explicit choice,
 * because it changes what happens on mount for an existing consumer.
 */
export interface AutoConnectOptions {
  /** Restore the wallet session on mount. Defaults to `false`. */
  enabled?: boolean
  /**
   * Also persist the connected public address, so a UI can render it during
   * the moment between mount and the wallet answering. Defaults to `false`.
   *
   * Only ever the public address. Nothing secret is persisted — a wallet
   * adapter holds no key material and this hook must not start.
   */
  persistAddress?: boolean
  /** Where to persist. Defaults to `"local"` (`localStorage`). */
  storage?: "local" | "session"
}

/**
 * Context value provided by the StellarProvider.
 */
export interface StellarContextValue {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  setWallet: Dispatch<SetStateAction<WalletState>>
  /** Fully-resolved autoconnect options. `enabled` is `false` unless opted in. */
  autoConnect: Required<AutoConnectOptions>
  /** Shared query/cache store. All fetching hooks read and write through this. */
  queryStore: QueryStore
}

export interface UsePaymentsOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
}

export interface UsePaymentsReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Options for fetching an account's transaction history.
 */
export interface UseTransactionHistoryOptions {
  address?: string | null // defaults to the connected wallet
  limit?: number // default 10
  order?: "asc" | "desc" // default "desc"
  cursor?: string
}

/**
 * A normalized transaction record for display or processing.
 */
export interface NormalizedTransaction {
  hash: string
  ledger: number
  createdAt: string
  sourceAccount: string
  fee: string
  operationCount: number
  successful: boolean
  memo?: string
  memoType?: string
}

export interface UseTransactionHistoryReturn {
  transactions: NormalizedTransaction[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

export interface UsePaymentHistoryOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
  direction?: "incoming" | "outgoing" | "all"
  asset?: Asset | "all"
}

export interface UsePaymentHistoryReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}

export interface FederationRecord {
  stellarAddress: string
  accountId: string
  memoType?: string
  memo?: string
}

export interface UseFederationLookupOptions {
  address?: string | null
}

export interface UseFederationLookupReturn {
  record: FederationRecord | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

export interface UseAccountExistsOptions {
  address?: string | null
}

export type AccountExistsReason = "exists" | "not_funded" | "invalid_format" | "idle"

export interface UseAccountExistsReturn {
  exists: boolean | null
  reason: AccountExistsReason
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

// ── Path payments (swaps) ──────────────────────────────────────────────────
/**
 * A single conversion route returned by `usePaymentPaths`.
 */
export interface PaymentPath {
  /** Intermediate hops. Empty means a direct market exists. */
  path: Asset[]
  /** What leaves the sender's account on this route. */
  sourceAmount: string
  /** What arrives at the destination on this route. */
  destinationAmount: string
  /** `destinationAmount / sourceAmount`, as a precise decimal string. */
  rate: string
}

/**
 * Options for `usePaymentPaths`.
 *
 * The mode decides which amount you must supply: `strictSend` pins what you
 * send, `strictReceive` pins what the recipient gets.
 */
export type UsePaymentPathsOptions =
  | {
      mode: "strictSend"
      sourceAsset: Asset
      /** Required in `strictSend` mode — exactly what leaves your account. */
      sourceAmount: string
      destinationAsset: Asset
      destinationAmount?: never
      /**
       * Optional: restrict results to assets this account can actually
       * receive, which is usually what a UI wants.
       */
      destinationAddress?: string
      sourceAddress?: never
      enabled?: boolean
      /** Re-fetch on an interval. Quotes go stale in seconds. */
      watch?: boolean
      /** Polling interval in ms when `watch` is true (default 10000). */
      interval?: number
    }
  | {
      mode: "strictReceive"
      sourceAsset: Asset
      sourceAmount?: never
      destinationAsset: Asset
      /** Required in `strictReceive` mode — exactly what must arrive. */
      destinationAmount: string
      destinationAddress?: never
      /**
       * Optional: restrict results to assets this account actually holds, so
       * every quote is one the sender can pay with.
       */
      sourceAddress?: string
      enabled?: boolean
      /** Re-fetch on an interval. Quotes go stale in seconds. */
      watch?: boolean
      /** Polling interval in ms when `watch` is true (default 10000). */
      interval?: number
    }

export interface UsePaymentPathsReturn {
  /** Candidate routes, best rate first. Empty means no route exists. */
  paths: PaymentPath[]
  loading: boolean
  error: StellarError | null
  /** When the current `paths` were fetched. Quotes go stale in seconds. */
  lastUpdated: Date | null
  refetch: () => void
}

/**
 * Options for `usePathPayment`.
 *
 * `mode` discriminates which amount is pinned and which slippage bound is
 * required. Both bounds are required — there is no permissive default.
 */
export type PathPaymentOptions = FeeOptions &
  (
    | {
        mode: "strictSend"
        destination: string
        sendAsset: Asset
        /** Exactly what leaves your account. */
        sendAmount: string
        destAsset: Asset
        /** Required — the least the recipient will accept. Your slippage bound. */
        destMin: string
        /** Intermediate hops from `usePaymentPaths`. Empty means direct. */
        path?: Asset[]
        memo?: string
        sendMax?: never
        destAmount?: never
      }
    | {
        mode: "strictReceive"
        destination: string
        sendAsset: Asset
        /** Required — the most you will spend. Your slippage bound. */
        sendMax: string
        destAsset: Asset
        /** Exactly what arrives at the destination. */
        destAmount: string
        /** Intermediate hops from `usePaymentPaths`. Empty means direct. */
        path?: Asset[]
        memo?: string
        sendAmount?: never
        destMin?: never
      }
  )

export interface UsePathPaymentReturn {
  pathPayment: (options: PathPaymentOptions) => Promise<TransactionResult>
  loading: boolean
  error: StellarError | null
  result: TransactionResult | null
  reset: () => void
}

// ── Soroban contract events ────────────────────────────────────────────────
/**
 * One event emitted by a Soroban contract — the on-chain equivalent of a log
 * line, with structured topics and a data payload.
 */
export interface ContractEvent {
  id: string
  contractId: string
  ledger: number
  ledgerClosedAt: string
  /** Decoded with `scValToNative`. */
  topics: unknown[]
  value: unknown
  /** Raw XDR, for consumers that need it or when decoding failed. */
  raw: { topics: string[]; value: string }
  /** `true` when this event's topics or value could not be decoded. */
  decodeFailed?: boolean
}

/**
 * Options for `useContractEvents`.
 */
export interface UseContractEventsOptions {
  /** Contracts to watch. An inline array literal is safe — see the hook docs. */
  contractIds: string[]
  /** Topic filter, per the RPC's matching rules. */
  topics?: string[][]
  /**
   * Ledger to start from. Defaults to the RPC's latest ledger, so a fresh
   * subscription reports only what happens from now on.
   *
   * RPC providers retain a limited ledger window — typically around 24 hours.
   * A `startLedger` older than that window is an error, not an empty result.
   */
  startLedger?: number
  /** Poll interval in ms (default 5000). There is no streaming endpoint. */
  interval?: number
  /** Maximum events kept in memory (default 200). Oldest are dropped first. */
  bufferSize?: number
  enabled?: boolean
}

export interface UseContractEventsReturn {
  events: ContractEvent[]
  latestLedger: number | null
  loading: boolean
  error: StellarError | null
  clear: () => void
}

// ── Anchor stellar.toml (SEP-1) ────────────────────────────────────────────
/**
 * A currency supported by an anchor.
 */
export interface AnchorCurrency {
  code: string
  issuer: string | null
  name?: string
  desc?: string
  image?: string
  isAssetAnchored?: boolean
}

/**
 * Structured information about a Stellar anchor from its stellar.toml (SEP-1).
 */
export interface AnchorInfo {
  homeDomain: string
  /** SEP-10 challenge signer. Required before any SEP-10 flow. */
  signingKey: string | null
  /** SEP-10 endpoint. */
  webAuthEndpoint: string | null
  /** SEP-6 deposit/withdraw. */
  transferServer: string | null
  /** SEP-24 interactive deposit/withdraw. */
  transferServerSep24: string | null
  kycServer: string | null
  currencies: AnchorCurrency[]
  /** The raw parsed document, for fields this interface does not model. */
  raw: Record<string, unknown>
}

/**
 * Options for `useAnchor`.
 */
export interface UseAnchorOptions {
  homeDomain?: string | null
  /** Defaults to `true`; set `false` to fetch manually via `refetch()`. */
  autoFetch?: boolean
}

/**
 * Return value from `useAnchor`.
 */
export interface UseAnchorReturn {
  anchor: AnchorInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
