/**
 * Test double for `@stellar/stellar-sdk`.
 *
 * `jest.config.js` maps every `@stellar/stellar-sdk` import in this package to
 * this file, so it is the SDK as far as the unit suite is concerned.
 *
 * The guiding rule: **fake only the network boundary.** `Asset`, `Operation`,
 * `Memo`, `Networks`, `BASE_FEE`, `StrKey`, `Keypair` and `TransactionBuilder`
 * do no I/O — they build and encode objects according to Stellar's rules. Faking
 * them would mean asserting against our own invention rather than against the
 * protocol, which is worse than having no test. They are re-exported from the
 * real package untouched. Only `Horizon.Server` and `SorobanRpc.Server` are
 * replaced, and those are built per test by a factory rather than shared, so a
 * simulated failure cannot leak from one test into the next.
 *
 * Every address in this file is testnet. No mainnet account appears here.
 */

// Required by relative path on purpose, for two reasons. The mapper is anchored
// on `^@stellar/stellar-sdk$`, so a bare `requireActual("@stellar/stellar-sdk")`
// would resolve straight back to this file; and the package's `exports` map
// publishes no `./lib/*` subpath, so the package-relative form does not resolve
// either. A file path sidesteps both, and lands on the CommonJS build rather
// than the browser bundle jsdom would otherwise select.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actual: any = jest.requireActual("../../../node_modules/@stellar/stellar-sdk/lib/index.js")

// ── The real, deterministic SDK ──────────────────────────────────────────────
export const {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Claimant,
  Contract,
  FeeBumpTransaction,
  Keypair,
  Memo,
  MuxedAccount,
  Networks,
  Operation,
  StrKey,
  TimeoutInfinite,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} = actual

// ── Testnet fixtures ─────────────────────────────────────────────────────────

/** Throwaway testnet account used as the transaction source in tests. */
export const TESTNET_ADDRESS_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
/** Throwaway testnet account used as a payment destination in tests. */
export const TESTNET_ADDRESS_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
/** Throwaway testnet issuer used for issued-asset fixtures. */
export const TESTNET_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

/**
 * A source account the real `TransactionBuilder` accepts.
 *
 * The real `loadAccount` resolves an `AccountResponse`, which carries the
 * Horizon record *and* the `Account` interface (`accountId()`,
 * `sequenceNumber()`, `incrementSequenceNumber()`). A plain object satisfies
 * only half of that, and `new TransactionBuilder(...)` throws on the other half.
 */
export function createMockAccountRecord(
  address: string = TESTNET_ADDRESS_A,
  sequence = "1234567890123456"
) {
  const account = new actual.Account(address, sequence)

  return Object.assign(account, {
    id: address,
    account_id: address,
    subentry_count: 2,
    thresholds: {
      low_threshold: 1,
      med_threshold: 2,
      high_threshold: 3,
    },
    signers: [{ key: address, weight: 1, type: "ed25519_public_key" }],
    balances: [
      {
        asset_type: "native",
        balance: "100.0000000",
        buying_liabilities: "0.0000000",
        selling_liabilities: "0.0000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: TESTNET_ISSUER,
        balance: "250.5000000",
        limit: "1000.0000000",
        buying_liabilities: "0.0000000",
        selling_liabilities: "0.0000000",
        is_authorized: true,
        is_authorized_to_maintain_liabilities: true,
      },
      {
        asset_type: "liquidity_pool_shares",
        balance: "50.0000000",
        liquidity_pool_id: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
      },
    ],
  })
}

/** The default source account. Prefer `createMockAccountRecord()` per test. */
export const mockAccountRecord = createMockAccountRecord()

export const mockTransactionRecord = {
  hash: "abcdef1234567890",
  successful: true,
  ledger: 12345,
  created_at: "2024-01-01T00:00:00Z",
  fee_charged: "100",
}

/** A successful `submitTransaction` response, shaped as Horizon returns it. */
export const mockSubmitResponse = {
  hash: "3389e9f0f1a65f19736cacf544c2e825313e8447f569233bb8db39aa607c8889",
  ledger: 12345,
  successful: true,
  envelope_xdr: "",
  result_xdr: "",
  result_meta_xdr: "",
}

export const mockServerResponses = {
  accountFound: mockAccountRecord,
  accountNotFound: new Error("Request failed with status code 404"),
  transactionFound: mockTransactionRecord,
  transactionNotFound: { response: { status: 404 } },
  networkError: new Error("Network Error"),
}

// ── Fake network boundary ────────────────────────────────────────────────────

/**
 * A Horizon collection builder with the fluent chain the hooks use.
 * Every link returns the builder, so
 * `.forAccount(x).limit(10).order("desc").call()` resolves to whatever
 * `records` were configured.
 */
function createCollectionBuilder(records: unknown[] = []) {
  const builder: Record<string, jest.Mock> = {}
  const chain = [
    "forAccount",
    "forClaimant",
    "claimant",
    "forAssetPair",
    "forTransaction",
    "transaction",
    "accountId",
    "cursor",
    "limit",
    "order",
    "includeFailed",
    "join",
  ]

  for (const method of chain) {
    builder[method] = jest.fn(() => builder)
  }

  builder.call = jest.fn(async () => ({ records, next: async () => ({ records: [] }) }))
  builder.stream = jest.fn(() => jest.fn())

  return builder
}

/**
 * Builds a fresh Horizon server double.
 *
 * A factory rather than a singleton on purpose: the previous shared instance
 * carried one mutable `shouldThrow` flag, so a test that simulated a failure
 * left the next test to fail for a reason it never asked for.
 *
 * Every method is a `jest.fn()` with a working default, so a test overrides only
 * the call it cares about:
 *
 * ```ts
 * const server = createMockHorizonServer()
 * server.submitTransaction.mockRejectedValueOnce(horizonError(TIMEOUT))
 * ```
 */
export function createMockHorizonServer(overrides: Record<string, unknown> = {}) {
  const server = {
    loadAccount: jest.fn(async (address: string = TESTNET_ADDRESS_A) =>
      createMockAccountRecord(address)
    ),
    submitTransaction: jest.fn(async () => mockSubmitResponse),
    fetchBaseFee: jest.fn(async () => 100),
    feeStats: jest.fn(async () => ({
      last_ledger_base_fee: "100",
      fee_charged: { min: "100", mode: "100", p50: "100", p99: "1000" },
      max_fee: { min: "100", mode: "100", p50: "100", p99: "1000" },
    })),
    transactions: jest.fn(() => createCollectionBuilder([mockTransactionRecord])),
    payments: jest.fn(() => createCollectionBuilder()),
    operations: jest.fn(() => createCollectionBuilder()),
    offers: jest.fn(() => createCollectionBuilder()),
    trades: jest.fn(() => createCollectionBuilder()),
    assets: jest.fn(() => createCollectionBuilder()),
    claimableBalances: jest.fn(() => createCollectionBuilder()),
    orderbook: jest.fn(() => createCollectionBuilder()),
    strictSendPaths: jest.fn(() => createCollectionBuilder()),
    strictReceivePaths: jest.fn(() => createCollectionBuilder()),
  }

  return Object.assign(server, overrides)
}

export type MockHorizonServer = ReturnType<typeof createMockHorizonServer>

/**
 * A Soroban RPC double. Same reasoning as the Horizon factory: per test, never
 * shared.
 */
export function createMockSorobanServer(overrides: Record<string, unknown> = {}) {
  const server = {
    getEvents: jest.fn(async () => ({ events: [], latestLedger: 1 })),
    simulateTransaction: jest.fn(async () => ({
      result: { retval: undefined },
      cost: { cpuInsns: "0", memBytes: "0" },
      latestLedger: 1,
    })),
    sendTransaction: jest.fn(async () => ({ status: "PENDING", hash: mockSubmitResponse.hash })),
    getTransaction: jest.fn(async () => ({ status: "SUCCESS" })),
    getLatestLedger: jest.fn(async () => ({ sequence: 1 })),
  }

  return Object.assign(server, overrides)
}

/**
 * The servers every `new Horizon.Server(...)` / `new SorobanRpc.Server(...)`
 * returns unless a test injects its own. Call `resetMockServers()` from a
 * `beforeEach` when a test file drives them directly.
 */
export let mockHorizonServer = createMockHorizonServer()
export let mockSorobanServer = createMockSorobanServer()

/** Discards the default servers so no state survives into the next test. */
export function resetMockServers() {
  mockHorizonServer = createMockHorizonServer()
  mockSorobanServer = createMockSorobanServer()
}

export const Horizon = {
  ...actual.Horizon,
  Server: class Server {
    constructor() {
      return mockHorizonServer
    }
  },
}

export const SorobanRpc = {
  ...actual.SorobanRpc,
  Server: class Server {
    constructor() {
      return mockSorobanServer
    }
  },
}

/** `rpc` is the newer name for the same namespace; keep both reachable. */
export const rpc = SorobanRpc

const stellarSdkMock = {
  ...actual,
  Horizon,
  SorobanRpc,
  rpc,
}

export default stellarSdkMock
