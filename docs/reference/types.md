# TypeScript Types Reference

Complete reference of every TypeScript type and interface exported by `use-stellar`. All types are organized by category with field-by-field documentation.

## Network Types

### `StellarNetwork`

The Stellar network environment.

```typescript
type StellarNetwork = "testnet" | "mainnet" | "futurenet" | "custom"
```

| Value | Description |
| --- | --- |
| `"testnet"` | SDF Testnet — use for development and testing |
| `"mainnet"` | Production network — use for real transactions |
| `"futurenet"` | SDF Futurenet — where new protocol features land before testnet |
| `"custom"` | Any other network: a local standalone/quickstart node, or a private deployment. Ships no defaults, so `networkConfig` must supply the endpoints **and** the passphrase. |

### `NetworkConfig`

Configuration details for a specific Stellar network, as resolved by
`StellarProvider`.

```typescript
interface NetworkConfig {
  network: StellarNetwork
  horizonUrl: string
  sorobanUrl: string
  networkPassphrase: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `network` | `StellarNetwork` | The network identifier |
| `horizonUrl` | `string` | Horizon API endpoint URL for this network |
| `sorobanUrl` | `string` | Soroban RPC endpoint URL for this network |
| `networkPassphrase` | `string` | The passphrase every transaction is signed against. Mixed into the transaction hash, which is what binds a signature to one network. |

**Example:**
```typescript
const testnetConfig: NetworkConfig = {
  network: "testnet",
  horizonUrl: "https://horizon-testnet.stellar.org",
  sorobanUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
}
```

### `CustomNetworkConfig`

The override accepted by `StellarProvider`'s `networkConfig` prop.

```typescript
interface CustomNetworkConfig {
  horizonUrl: string
  sorobanUrl: string
  networkPassphrase?: string
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `horizonUrl` | `string` | Yes | Horizon API endpoint |
| `sorobanUrl` | `string` | Yes | Soroban RPC endpoint |
| `networkPassphrase` | `string` | Only for `network="custom"` | Optional for `testnet`, `mainnet`, and `futurenet`, whose passphrases are known. Required for `"custom"` — the provider throws at render without it, rather than signing against a guess. |

### `NETWORK_PASSPHRASES`

The passphrase for each network this library ships defaults for.

```typescript
const NETWORK_PASSPHRASES: Record<"testnet" | "mainnet" | "futurenet", string>
```

### `getNetworkPassphrase`

Returns the passphrase for a network, or `undefined` for `"custom"`.

```typescript
function getNetworkPassphrase(network: StellarNetwork): string | undefined
```

Prefer this over indexing `NETWORK_PASSPHRASES` directly: a custom network
genuinely has no known passphrase, and `undefined` says so instead of handing
back the wrong one.

---

## Wallet Types

### `WalletType`

Supported wallet providers.

```typescript
type WalletType = "freighter" | "lobstr" | "albedo" | "rabet"
```

| Value | Status | Description |
| --- | --- | --- |
| `"freighter"` | ✅ Supported | Freighter browser extension |
| `"lobstr"` | ✅ Supported | LOBSTR browser extension |
| `"albedo"` | Open | Albedo wallet (contributions welcome) |
| `"rabet"` | Open | Rabet wallet (contributions welcome) |

### `WalletState`

The current state of the wallet connection.

```typescript
interface WalletState {
  connected: boolean
  connecting: boolean
  address: string | null
  network: StellarNetwork | null
  wallet: WalletType | null
  error: StellarError | null
  walletNetwork: StellarNetwork | null
  walletName: string | null
}
```

| Field | Type | Description |
| --- | --- | --- |
| `connected` | `boolean` | Whether a wallet is currently connected |
| `connecting` | `boolean` | Whether a wallet connection is in progress |
| `address` | `string \| null` | The connected wallet's public address (starts with `G`), or `null` if not connected |
| `network` | `StellarNetwork \| null` | The network configured in `StellarProvider` |
| `wallet` | `WalletType \| null` | The type of wallet currently connected, or `null` if not connected |
| `error` | `StellarError \| null` | The most recent wallet error, or `null` if no error |
| `walletNetwork` | `StellarNetwork \| null` | The actual network that the connected wallet extension is set to (may differ from `network` if there is a mismatch) |
| `walletName` | `string \| null` | Human-readable name of the connected wallet provider |

**Example:**
```typescript
const state: WalletState = {
  connected: true,
  connecting: false,
  address: "GDLUW7G2E66W4J2ZCXLVVXIWRW3EZVQIVXKX2BRVGJJF2MLFQZ7GDPR",
  network: "testnet",
  wallet: "freighter",
  error: null,
  walletNetwork: "testnet",
  walletName: "Freighter",
}
```

---

## Asset Types

### `NativeAsset`

The native Stellar asset (XLM).

```typescript
type NativeAsset = "XLM"
```

### `IssuedAsset`

A custom issued asset on the Stellar network.

```typescript
interface IssuedAsset {
  code: string
  issuer: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Asset code (e.g., `"USDC"`) |
| `issuer` | `string` | Stellar address of the asset issuer |

**Example:**
```typescript
const usdc: IssuedAsset = {
  code: "USDC",
  issuer: "GBBD47UZQ2EOPZMQAAECTYTFVISFZ5ARUJQ33XVQWF7KYZAKMTFS5KFU",
}
```

### `LiquidityPoolAsset`

A liquidity pool share on the Stellar network.

```typescript
interface LiquidityPoolAsset {
  asset: "liquidity_pool_shares"
  liquidityPoolId: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `asset` | `"liquidity_pool_shares"` | Type marker for liquidity pool shares |
| `liquidityPoolId` | `string` | The unique ID of the liquidity pool |

### `Asset`

A union type representing either a native or issued asset.

```typescript
type Asset = NativeAsset | IssuedAsset
```

Can be either `"XLM"` or an `IssuedAsset` object.

**Example:**
```typescript
const xlm: Asset = "XLM"

const usdc: Asset = {
  code: "USDC",
  issuer: "GBBD47UZQ2EOPZMQAAECTYTFVISFZ5ARUJQ33XVQWF7KYZAKMTFS5KFU",
}
```

### `AssetMetadata`

Extended asset information with validation metadata.

```typescript
interface AssetMetadata extends IssuedAsset {
  verified: boolean
  timestamp: number
}
```

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Asset code (inherited from `IssuedAsset`) |
| `issuer` | `string` | Asset issuer address (inherited from `IssuedAsset`) |
| `verified` | `boolean` | Whether the asset has been verified |
| `timestamp` | `number` | Verification timestamp (Unix milliseconds) |

---

## Balance & Account Types

### `Balance`

A balance entry for an account (returned in `AccountInfo.balances`).

```typescript
type Balance =
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
```

Each variant represents a different asset type:

**XLM balance:**
| Field | Type | Description |
| --- | --- | --- |
| `asset` | `"XLM"` | The native asset type marker |
| `balance` | `string` | XLM balance as a decimal string (e.g., `"100.5000000"`) |

**Issued asset balance:**
| Field | Type | Description |
| --- | --- | --- |
| `asset` | `IssuedAsset` | Object with `code` and `issuer` |
| `balance` | `string` | Balance of this asset as a decimal string |
| `limit` | `string` | The trustline limit for this asset |

**Liquidity pool balance:**
| Field | Type | Description |
| --- | --- | --- |
| `asset` | `"liquidity_pool_shares"` | Liquidity pool share type marker |
| `balance` | `string` | Balance of pool shares |
| `liquidityPoolId` | `string` | The ID of the liquidity pool |

### `AccountInfo`

Detailed account information from the Stellar network.

```typescript
interface AccountInfo {
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
```

| Field | Type | Description |
| --- | --- | --- |
| `address` | `string` | The account's public address |
| `sequence` | `string` | The account's sequence number (used to track transactions) |
| `balances` | `Balance[]` | Array of all assets held by this account |
| `subentryCount` | `number` | Number of subentries on the account (trustlines, offers, etc.) |
| `thresholds` | `object` | Signing thresholds for this account |
| `thresholds.lowThreshold` | `number` | Threshold for low-security operations (1–255) |
| `thresholds.medThreshold` | `number` | Threshold for medium-security operations (1–255) |
| `thresholds.highThreshold` | `number` | Threshold for high-security operations (1–255) |
| `signers` | `object[]` | Array of signing keys and their weights |
| `signers[].key` | `string` | The signer's public key or account ID |
| `signers[].weight` | `number` | The weight this signer carries (0–255) |
| `signers[].type` | `string` | The signer type (e.g., `"ed25519_public_key"`) |

**Example:**
```typescript
const account: AccountInfo = {
  address: "GDLUW7G2E66W4J2ZCXLVVXIWRW3EZVQIVXKX2BRVGJJF2MLFQZ7GDPR",
  sequence: "123456789",
  balances: [
    { asset: "XLM", balance: "100.5000000" },
    {
      asset: { code: "USDC", issuer: "GBBD47UZQ2EOPZMQAAECTYTFVISFZ5ARUJQ33XVQWF7KYZAKMTFS5KFU" },
      balance: "50.00",
      limit: "1000.00",
    },
  ],
  subentryCount: 5,
  thresholds: {
    lowThreshold: 0,
    medThreshold: 0,
    highThreshold: 0,
  },
  signers: [
    {
      key: "GDLUW7G2E66W4J2ZCXLVVXIWRW3EZVQIVXKX2BRVGJJF2MLFQZ7GDPR",
      weight: 1,
      type: "ed25519_public_key",
    },
  ],
}
```

---

## Transaction Types

### `TransactionStatus`

The current status of a transaction on the network.

```typescript
type TransactionStatus = "pending" | "success" | "failed" | "not_found"
```

| Value | Description |
| --- | --- |
| `"pending"` | Transaction has been submitted but not yet confirmed |
| `"success"` | Transaction was successfully applied to the ledger |
| `"failed"` | Transaction was submitted but failed (likely due to validation error) |
| `"not_found"` | Transaction hash does not exist on the network |

### `TransactionResult`

Result details from a submitted or queried transaction.

```typescript
interface TransactionResult {
  hash: string
  status: TransactionStatus
  ledger?: number
  createdAt?: string
  fee?: string
  envelope?: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `hash` | `string` | The transaction hash (hex string) |
| `status` | `TransactionStatus` | The current status of the transaction |
| `ledger` | `number` (optional) | The ledger number where this transaction was confirmed |
| `createdAt` | `string` (optional) | ISO 8601 timestamp when the transaction was submitted |
| `fee` | `string` (optional) | The total fee paid for this transaction in stroops |
| `envelope` | `string` (optional) | The transaction envelope XDR (for debugging) |

**Example:**
```typescript
const result: TransactionResult = {
  hash: "abc123def456...",
  status: "success",
  ledger: 47291234,
  createdAt: "2024-01-15T10:30:00Z",
  fee: "100",
  envelope: "AAAAAgAAAAB...",
}
```

---

## Payment Types

### `SendPaymentOptions`

Options for sending a payment transaction.

```typescript
interface SendPaymentOptions {
  to: string
  asset: Asset
  amount: string
  memo?: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `to` | `string` | Destination account address (starts with `G`) |
| `asset` | `Asset` | The asset to send: `"XLM"` or an `IssuedAsset` object |
| `amount` | `string` | Amount to send as a decimal string (e.g., `"10.5"`) |
| `memo` | `string` (optional) | A memo to attach to the transaction (max 28 characters) |

**Example:**
```typescript
const options: SendPaymentOptions = {
  to: "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR",
  asset: "XLM",
  amount: "1.5",
  memo: "Payment for services",
}
```

### `SendPaymentResult`

Result returned after a payment is sent.

```typescript
interface SendPaymentResult {
  hash: string
  status: TransactionStatus
}
```

| Field | Type | Description |
| --- | --- | --- |
| `hash` | `string` | The transaction hash of the submitted payment |
| `status` | `TransactionStatus` | The status of the payment on the network |

### `NormalizedPayment`

A normalized payment record for display or processing.

```typescript
interface NormalizedPayment {
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
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique operation ID |
| `txHash` | `string` | The transaction hash |
| `type` | `string` | Operation type (e.g., `"payment"`, `"create_account"`) |
| `from` | `string` | Sender's address |
| `to` | `string` | Recipient's address |
| `amount` | `string` | Amount transferred |
| `asset` | `Asset` | The asset that was transferred |
| `direction` | `"incoming" \| "outgoing"` | Whether this payment was received or sent |
| `createdAt` | `string` | ISO 8601 timestamp when the operation was created |

---

## Claimable Balance Types

### `ClaimableBalanceClaimant`

A claimant who can receive a claimable balance.

```typescript
interface ClaimableBalanceClaimant {
  destination: string
  predicate: object
}
```

| Field | Type | Description |
| --- | --- | --- |
| `destination` | `string` | The account that can claim this balance |
| `predicate` | `object` | Conditions that must be met to claim (e.g., time locks) |

### `ClaimableBalance`

A claimable balance (an asset set aside for someone to claim).

```typescript
interface ClaimableBalance {
  id: string
  asset: string
  amount: string
  claimants: ClaimableBalanceClaimant[]
  sponsor?: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique claimable balance ID |
| `asset` | `string` | The asset code (e.g., `"XLM"`) |
| `amount` | `string` | Amount available to claim |
| `claimants` | `ClaimableBalanceClaimant[]` | Array of accounts that can claim this balance |
| `sponsor` | `string` (optional) | Account sponsoring this claimable balance |

---

## Soroban Contract Types

### `ContractCallOptions`

Options for calling a Soroban smart contract.

```typescript
interface ContractCallOptions {
  contractId: string
  method: string
  args?: unknown[]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `contractId` | `string` | The contract ID (starts with `C`, followed by 55 alphanumeric characters) |
| `method` | `string` | The contract method/function name to call |
| `args` | `unknown[]` (optional) | Arguments to pass to the contract method |

**Example:**
```typescript
const options: ContractCallOptions = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  method: "balance",
  args: ["GDLUW7G2E66W4J2ZCXLVVXIWRW3EZVQIVXKX2BRVGJJF2MLFQZ7GDPR"],
}
```

---

## Error Types

### `StellarErrorCode`

A stable, machine-readable error classification. Used to branch on error types in application code.

```typescript
type StellarErrorCode =
  | "WALLET_NOT_INSTALLED"
  | "WALLET_NOT_CONNECTED"
  | "WALLET_REQUEST_REJECTED"
  | "WRONG_NETWORK"
  | "ACCOUNT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "NO_TRUSTLINE"
  | "TRANSACTION_FAILED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN"
```

| Code | Category | Description |
| --- | --- | --- |
| `"WALLET_NOT_INSTALLED"` | Wallet | Freighter or other wallet extension is not installed |
| `"WALLET_NOT_CONNECTED"` | Wallet | An action required a connected wallet but none was connected |
| `"WALLET_REQUEST_REJECTED"` | Wallet | User rejected the wallet request |
| `"WRONG_NETWORK"` | Wallet | Wallet is connected to a different network than the provider |
| `"ACCOUNT_NOT_FOUND"` | Horizon | Account or resource does not exist on the ledger (404) |
| `"INSUFFICIENT_BALANCE"` | Horizon | Source account lacks funds to complete the operation |
| `"NO_TRUSTLINE"` | Horizon | Destination does not hold a trustline for the asset |
| `"TRANSACTION_FAILED"` | Horizon | Transaction was submitted but failed on the network |
| `"RATE_LIMITED"` | Horizon | Horizon rate-limited the request (429) |
| `"VALIDATION_ERROR"` | Validation | Caller-supplied input was invalid |
| `"NETWORK_ERROR"` | Network | Transport-level failure (offline, DNS, timeout, CORS) |
| `"UNKNOWN"` | Fallback | Unable to classify the error |

### `StellarError`

A typed error with a stable error code and human-readable message.

```typescript
class StellarError extends Error {
  readonly code: StellarErrorCode
  readonly raw?: unknown
  constructor(code: StellarErrorCode, message?: string, options?: StellarErrorOptions)
}
```

| Property | Type | Description |
| --- | --- | --- |
| `code` | `StellarErrorCode` | Stable, machine-readable classification |
| `message` | `string` | Human-readable error message (inherited from `Error`) |
| `raw` | `unknown` (optional) | The original error (Horizon response, wallet error, etc.) for debugging |

**Example:**
```typescript
try {
  await send({ to: "...", asset: "XLM", amount: "100" })
} catch (err) {
  if (err instanceof StellarError) {
    if (err.code === "INSUFFICIENT_BALANCE") {
      console.error("Not enough XLM:", err.message)
    } else {
      console.error("Error:", err.message)
    }
  }
}
```

### `StellarErrorOptions`

Options for constructing a `StellarError`.

```typescript
interface StellarErrorOptions {
  raw?: unknown
}
```

| Field | Type | Description |
| --- | --- | --- |
| `raw` | `unknown` (optional) | The original error this was derived from |

---

## Context Types

### `StellarContextValue`

The context value provided by `StellarProvider` to all child components.

```typescript
interface StellarContextValue {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  setWallet: Dispatch<SetStateAction<WalletState>>
}
```

| Field | Type | Description |
| --- | --- | --- |
| `network` | `StellarNetwork` | The current network (`"testnet"` or `"mainnet"`) |
| `networkConfig` | `NetworkConfig` | Configuration object with URLs for the current network |
| `wallet` | `WalletState` | Current wallet connection state |
| `setWallet` | `Dispatch<SetStateAction<WalletState>>` | Function to update wallet state (internal use) |

---

## Hook Return Types

### `UseWalletReturn`

Return value from the `useWallet()` hook.

```typescript
interface UseWalletReturn extends WalletState {
  connect: (wallet?: WalletType) => Promise<void>
  disconnect: () => void
  refreshWalletNetwork: () => Promise<void>
  isNetworkMismatch: boolean
}
```

| Field | Type | Description |
| --- | --- | --- |
| (All fields from `WalletState`) | — | Includes all `WalletState` fields |
| `connect` | `(wallet?: WalletType) => Promise<void>` | Connect to a wallet (defaults to `"freighter"`) |
| `disconnect` | `() => void` | Disconnect the current wallet |
| `refreshWalletNetwork` | `() => Promise<void>` | Re-sync the wallet's actual network |
| `isNetworkMismatch` | `boolean` | Whether the wallet's network differs from the provider's network |

**See:** [`useWallet`](/docs/hooks/useWallet.md)

### `UseBalanceReturn`

Return value from the `useBalance()` hook.

```typescript
interface UseBalanceReturn {
  balance: string | null
  balances: Balance[]
  loading: boolean
  error: StellarError | null
  lastUpdated: Date | null
  refetch: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `balance` | `string \| null` | The balance for the requested asset as a decimal string, or `null` if not loaded |
| `balances` | `Balance[]` | Array of all balances for the account |
| `loading` | `boolean` | Whether data is currently being fetched |
| `error` | `StellarError \| null` | Any error from the fetch, or `null` if successful |
| `lastUpdated` | `Date \| null` | Timestamp of the last successful fetch |
| `refetch` | `() => void` | Manually refetch the balance |

**See:** [`useBalance`](/docs/hooks/useBalance.md)

### `UseAccountReturn`

Return value from the `useAccount()` hook.

```typescript
interface UseAccountReturn {
  account: AccountInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `account` | `AccountInfo \| null` | Full account information, or `null` if not loaded |
| `loading` | `boolean` | Whether data is currently being fetched |
| `error` | `StellarError \| null` | Any error from the fetch, or `null` if successful |
| `refetch` | `() => void` | Manually refetch account information |

**See:** [`useAccount`](/docs/hooks/useAccount.md)

### `UseTransactionReturn`

Return value from the `useTransaction()` hook.

```typescript
interface UseTransactionReturn {
  transaction: TransactionResult | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `transaction` | `TransactionResult \| null` | Transaction details, or `null` if not found |
| `loading` | `boolean` | Whether data is currently being fetched |
| `error` | `StellarError \| null` | Any error from the fetch, or `null` if successful |
| `refetch` | `() => void` | Manually refetch transaction status |

**See:** [`useTransaction`](/docs/hooks/useTransaction.md)

### `UseNetworkReturn`

Return value from the `useNetwork()` hook.

```typescript
interface UseNetworkReturn {
  network: StellarNetwork
  networkConfig: NetworkConfig
  isTestnet: boolean
  isMainnet: boolean
}
```

| Field | Type | Description |
| --- | --- | --- |
| `network` | `StellarNetwork` | The current network |
| `networkConfig` | `NetworkConfig` | URLs and config for the current network |
| `isTestnet` | `boolean` | Whether the current network is testnet |
| `isMainnet` | `boolean` | Whether the current network is mainnet |

**See:** [`useNetwork`](/docs/hooks/useNetwork.md)

### `UseAssetReturn`

Return value from the `useAsset()` hook.

```typescript
interface UseAssetReturn {
  asset: AssetInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `asset` | `AssetInfo \| null` | Asset metadata, or `null` if not loaded |
| `loading` | `boolean` | Whether data is currently being fetched |
| `error` | `StellarError \| null` | Any error from the fetch, or `null` if successful |
| `refetch` | `() => void` | Manually refetch asset information |

**See:** [`useAsset`](/docs/hooks/useAsset.md)

### `AssetInfo`

Asset metadata returned by the `useAsset()` hook.

```typescript
interface AssetInfo {
  code: string
  issuer: string
  supply: string
  homeDomain?: string
  numAccounts: number
  flags: {
    authRequired: boolean
    authRevocable: boolean
    authImmutable: boolean
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Asset code (e.g., `"USDC"`) |
| `issuer` | `string` | Asset issuer's Stellar address |
| `supply` | `string` | Total supply of this asset |
| `homeDomain` | `string` (optional) | Home domain associated with the asset |
| `numAccounts` | `number` | Number of accounts holding this asset |
| `flags` | `object` | Boolean flags set on this asset |
| `flags.authRequired` | `boolean` | Whether the issuer must approve trustlines |
| `flags.authRevocable` | `boolean` | Whether the issuer can revoke balances |
| `flags.authImmutable` | `boolean` | Whether auth flags can be changed |

### `UseSendPaymentReturn`

Return value from the `useSendPayment()` hook.

```typescript
interface UseSendPaymentReturn {
  send: (options: SendPaymentOptions) => Promise<SendPaymentResult & { error?: string }>
  loading: boolean
  error: StellarError | null
  result: SendPaymentResult | null
  reset: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `send` | `(options: SendPaymentOptions) => Promise<SendPaymentResult>` | Function to submit a payment |
| `loading` | `boolean` | Whether a payment is currently being sent |
| `error` | `StellarError \| null` | Any error from the most recent payment attempt |
| `result` | `SendPaymentResult \| null` | The result of the most recent successful payment |
| `reset` | `() => void` | Clear `error` and `result` state |

**See:** [`useSendPayment`](/docs/hooks/useSendPayment.md)

### `UsePaymentsReturn`

Return value from the `usePayments()` hook.

```typescript
interface UsePaymentsReturn {
  payments: NormalizedPayment[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
  fetchNext: () => Promise<void>
  fetchPrev: () => Promise<void>
  hasNext: boolean
  hasPrev: boolean
}
```

| Field | Type | Description |
| --- | --- | --- |
| `payments` | `NormalizedPayment[]` | Array of normalized payment records |
| `loading` | `boolean` | Whether data is currently being fetched |
| `error` | `StellarError \| null` | Any error from the fetch |
| `refetch` | `() => void` | Manually refetch the current page of payments |
| `fetchNext` | `() => Promise<void>` | Load the next page of payments |
| `fetchPrev` | `() => Promise<void>` | Load the previous page of payments |
| `hasNext` | `boolean` | Whether there are more payments to load |
| `hasPrev` | `boolean` | Whether there are previous pages to load |

**See:** [`usePayments`](/docs/hooks/usePayments.md)

### `UseClaimableBalanceReturn`

Return value from the `useClaimableBalance()` hook.

```typescript
interface UseClaimableBalanceReturn {
  balances: ClaimableBalance[]
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `balances` | `ClaimableBalance[]` | Array of claimable balances for the account |
| `loading` | `boolean` | Whether data is currently being fetched |
| `error` | `StellarError \| null` | Any error from the fetch |
| `refetch` | `() => void` | Manually refetch claimable balances |

**See:** [`useClaimableBalance`](/docs/hooks/useClaimableBalance.md)

### `UseSorobanContractReturn`

Return value from the `useSorobanContract()` hook.

```typescript
interface UseSorobanContractReturn {
  data: unknown | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

| Field | Type | Description |
| --- | --- | --- |
| `data` | `unknown \| null` | The result of calling the contract method, or `null` if not loaded |
| `loading` | `boolean` | Whether the contract call is in progress |
| `error` | `StellarError \| null` | Any error from the contract call |
| `refetch` | `() => void` | Manually retry the contract call |

**See:** [`useSorobanContract`](/docs/hooks/useSorobanContract.md)

### `UseAssetOptions`

Options for the `useAsset()` hook.

```typescript
interface UseAssetOptions {
  code: string
  issuer: string
  autoFetch?: boolean
}
```

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Asset code to look up |
| `issuer` | `string` | Issuer address of the asset |
| `autoFetch` | `boolean` (optional) | Whether to automatically fetch on mount (default: `true`) |

### `UseBalanceOptions`

Options for the `useBalance()` hook.

```typescript
interface UseBalanceOptions {
  address?: string | null
  asset?: Asset
  watch?: boolean
  interval?: number
}
```

| Field | Type | Description |
| --- | --- | --- |
| `address` | `string \| null` (optional) | Account to fetch balance for (defaults to connected wallet) |
| `asset` | `Asset` (optional) | Asset to fetch balance for (defaults to `"XLM"`) |
| `watch` | `boolean` (optional) | Whether to auto-refresh on an interval (default: `false`) |
| `interval` | `number` (optional) | Polling interval in milliseconds when `watch` is true (default: `10000`) |

### `UseAccountOptions`

Options for the `useAccount()` hook.

```typescript
interface UseAccountOptions {
  address?: string | null
}
```

| Field | Type | Description |
| --- | --- | --- |
| `address` | `string \| null` (optional) | Account to fetch (defaults to connected wallet) |

### `UseTransactionOptions`

Options for the `useTransaction()` hook.

```typescript
interface UseTransactionOptions {
  hash: string | null
  watch?: boolean
}
```

| Field | Type | Description |
| --- | --- | --- |
| `hash` | `string \| null` | Transaction hash to look up |
| `watch` | `boolean` (optional) | Keep polling until the transaction succeeds or fails (default: `false`) |

### `UsePaymentsOptions`

Options for the `usePayments()` hook.

```typescript
interface UsePaymentsOptions {
  address?: string | null
  limit?: number
  order?: "asc" | "desc"
  cursor?: string
}
```

| Field | Type | Description |
| --- | --- | --- |
| `address` | `string \| null` (optional) | Account to fetch payments for (defaults to connected wallet) |
| `limit` | `number` (optional) | Maximum number of payments to fetch (default: `10`) |
| `order` | `"asc" \| "desc"` (optional) | Sort order by date (default: `"desc"`) |
| `cursor` | `string` (optional) | Pagination cursor for fetching specific pages |

### `UseClaimableBalanceOptions`

Options for the `useClaimableBalance()` hook.

```typescript
interface UseClaimableBalanceOptions {
  address?: string | null
}
```

| Field | Type | Description |
| --- | --- | --- |
| `address` | `string \| null` (optional) | Account to fetch claimable balances for (defaults to connected wallet) |

---

## Importing Types

Import types from `use-stellar`:

```typescript
import type {
  StellarNetwork,
  NetworkConfig,
  WalletState,
  Asset,
  Balance,
  AccountInfo,
  TransactionResult,
  SendPaymentOptions,
  SendPaymentResult,
  StellarError,
  StellarErrorCode,
} from "use-stellar"
```
