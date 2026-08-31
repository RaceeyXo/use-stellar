/**
 * Manual Jest mock for @stellar/stellar-sdk
 * ─────────────────────────────────────────
 * Strategy: re-export every pure, deterministic SDK export unchanged so that
 * tests assert against Stellar's real encoding rules.  Only the network
 * boundary — Horizon.Server and SorobanRpc.Server — is replaced with
 * controllable jest.fn() doubles.
 *
 * Why not mock TransactionBuilder / Asset / Operation / etc.?
 * Mocking them means tests assert against your own fake instead of against
 * Stellar's XDR encoding.  That's worse than no test — the mock can encode
 * a transaction that the real network would reject and no test would catch it.
 *
 * The moduleNameMapper in jest.config.js routes every import of
 * "@stellar/stellar-sdk" in the core package to this file.  jest.requireActual
 * called from inside a moduleNameMapper target bypasses the mapper, so it
 * reaches the real SDK on disk.
 *
 * Exports:
 *   TESTNET_ADDRESS_A / TESTNET_ADDRESS_B  — real valid testnet addresses
 *   TESTNET_KEYPAIR                        — throwaway testnet keypair
 *   mockAccountRecord                      — real Account instance (works with TransactionBuilder)
 *   mockAccountData                        — full Horizon loadAccount-shaped object
 *   mockSubmitResponse                     — realistic Horizon submit response
 *   mockTransactionRecord                  — realistic Horizon transaction record
 *   mockHorizonServer                      — backward-compat singleton (call .reset() in beforeEach)
 *   createMockHorizonServer(overrides?)    — per-test isolated server factory (preferred)
 *   createMockSorobanServer(overrides?)    — per-test isolated RPC factory
 *   createCollectionBuilder(overrides?)    — fluent Horizon query builder mock
 */

// ── Real SDK (pure, no I/O) ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actual = jest.requireActual("@stellar/stellar-sdk") as any

// Re-export the pure encoding types verbatim.  Tests that use these will
// assert against Stellar's real XDR encoding, not a homemade fake.
export const Asset = actual.Asset
export const Operation = actual.Operation
export const Memo = actual.Memo
export const Networks = actual.Networks
export const BASE_FEE = actual.BASE_FEE
export const StrKey = actual.StrKey
export const TransactionBuilder = actual.TransactionBuilder
export const Account = actual.Account
export const Contract = actual.Contract
export const xdr = actual.xdr
export const scValToNative = actual.scValToNative
export const nativeToScVal = actual.nativeToScVal
export const Address = actual.Address
export const MuxedAccount = actual.MuxedAccount
export const LiquidityPoolAsset = actual.LiquidityPoolAsset
export const FeeBumpTransaction = actual.FeeBumpTransaction

// ── Known testnet addresses (never mainnet) ────────────────────────────────────
/**
 * Real Stellar testnet public keys used as sender/destination in fixtures.
 * Safe to hardcode — testnet only, no real-world value.
 */
export const TESTNET_ADDRESS_A =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"

export const TESTNET_ADDRESS_B =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

/**
 * A throwaway testnet keypair — hardcoded for test stability.
 * This is NOT a mainnet key and holds no real-world value.
 *
 * Public key : GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN
 * Secret key : SCZANGBA5QLSR7HZLQ57UH3VXCBLWXRGKEVXHXBE4BKHE45EX44YFQ6
 *
 * The old mock returned a fake "SAAZI4TCR3TY..." secret — the public key with
 * the first character swapped.  That is 56 chars instead of 56 and fails the
 * strkey checksum, so Keypair.fromSecret() would throw.  This one is real.
 */
export const TESTNET_KEYPAIR = {
  publicKey: TESTNET_ADDRESS_A,
  // Valid Stellar testnet secret (throwaway key, testnet only).
  secret: "SCZANGBA5QLSR7HZLQ57UH3VXCBLWXRGKEVXHXBE4BKHE45EX44YFQ6",
}

// ── Account fixture ────────────────────────────────────────────────────────────
/**
 * A real SDK Account instance that TransactionBuilder accepts as a source.
 *
 * TransactionBuilder requires its first argument to have:
 *   accountId(): string
 *   sequenceNumber(): string
 *   incrementSequenceNumber(): void
 *
 * The old mock's plain-object mockAccountRecord did not have these methods, so
 * any test that reached transaction-building threw "accountId is not a function".
 * Using the real Account class fixes that entirely.
 */
export const mockAccountRecord = new actual.Account(TESTNET_ADDRESS_A, "100")

/**
 * Full Horizon-shaped account data that loadAccount() resolves to.
 * Includes both the TransactionBuilder-interface methods (accountId, etc.)
 * and the balance/signer fields the hooks consume.
 *
 * Spread and override individual fields per test:
 *   server.loadAccount.mockResolvedValue({ ...mockAccountData, id: otherAddress })
 */
export const mockAccountData = {
  id: TESTNET_ADDRESS_A,
  // TransactionBuilder source-account interface
  accountId: () => TESTNET_ADDRESS_A,
  sequenceNumber: () => "100",
  incrementSequenceNumber: () => {},
  // Standard Horizon account fields
  sequence: "100",
  subentry_count: 2,
  thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
  signers: [
    { key: TESTNET_ADDRESS_A, weight: 1, type: "ed25519_public_key" },
  ],
  balances: [
    { asset_type: "native", balance: "100.0000000" },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      balance: "250.5000000",
      limit: "1000.0000000",
    },
    {
      asset_type: "liquidity_pool_shares",
      balance: "50.0000000",
      liquidity_pool_id: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
    },
  ],
}

// ── Transaction fixtures ────────────────────────────────────────────────────────
/**
 * Realistic Horizon response shape for a successful submitTransaction().
 * Hash is a real 64-hex-character string (Stellar transaction hash format).
 */
export const mockSubmitResponse = {
  hash: "6bc97c2de76b1ba73d887f61b81df8dba7ef7c8e965d0e1d54a8e93e6e37625c",
  ledger: 12345,
  successful: true,
  envelope_xdr: "",
  result_xdr: "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=",
  result_meta_xdr: "",
  created_at: "2024-01-01T00:00:00Z",
  fee_charged: "1000",
}

/** Realistic Horizon transaction record (from server.transactions().transaction(hash).call()). */
export const mockTransactionRecord = {
  hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  successful: true,
  ledger: 12345,
  created_at: "2024-01-01T00:00:00Z",
  fee_charged: "100",
  source_account: TESTNET_ADDRESS_A,
  operation_count: 1,
  envelope_xdr: "",
  result_xdr: "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=",
}

// ── Collection builder factory ──────────────────────────────────────────────────
/**
 * Creates a fluent Horizon query builder mock.
 *
 * Real Horizon builders chain like:
 *   server.transactions().forAccount(addr).limit(20).order("desc").call()
 *   server.transactions().transaction(hash).call()
 *   server.claimableBalances().claimant(addr).call()
 *
 * Each chainable method (forAccount, limit, order, cursor, transaction,
 * claimant) returns the builder itself.  call() is a jest.fn() — drive it
 * with mockResolvedValue / mockRejectedValue in tests.
 *
 * stream() returns a jest.fn() that acts as the "close" callback, matching
 * the real SDK's streaming interface.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCollectionBuilder(overrides: Record<string, jest.Mock> = {}): {
  call: jest.Mock
  stream: jest.Mock
  cursor: jest.Mock
  limit: jest.Mock
  order: jest.Mock
  forAccount: jest.Mock
  transaction: jest.Mock
  claimant: jest.Mock
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {
    call: jest.fn().mockResolvedValue({ records: [] }),
    stream: jest.fn().mockReturnValue(jest.fn()),
    cursor: jest.fn(),
    limit: jest.fn(),
    order: jest.fn(),
    forAccount: jest.fn(),
    transaction: jest.fn(),
    claimant: jest.fn(),
    ...overrides,
  }

  // Chain: every method (except call/stream) returns the builder itself.
  const CHAIN_METHODS = ["cursor", "limit", "order", "forAccount", "transaction", "claimant"]
  for (const key of CHAIN_METHODS) {
    if (!overrides[key]) builder[key].mockReturnValue(builder)
  }

  return builder as ReturnType<typeof createCollectionBuilder>
}

// ── MockHorizonServer factory ────────────────────────────────────────────────────
export interface MockHorizonServerOverrides {
  loadAccount?: jest.Mock
  submitTransaction?: jest.Mock
  fetchBaseFee?: jest.Mock
  transactions?: jest.Mock
  payments?: jest.Mock
  operations?: jest.Mock
  offers?: jest.Mock
  orderbook?: jest.Mock
  strictSendPaths?: jest.Mock
  strictReceivePaths?: jest.Mock
  feeStats?: jest.Mock
  assets?: jest.Mock
  claimableBalances?: jest.Mock
}

export interface MockHorizonServerInstance {
  loadAccount: jest.Mock
  submitTransaction: jest.Mock
  fetchBaseFee: jest.Mock
  transactions: jest.Mock
  payments: jest.Mock
  operations: jest.Mock
  offers: jest.Mock
  orderbook: jest.Mock
  strictSendPaths: jest.Mock
  strictReceivePaths: jest.Mock
  feeStats: jest.Mock
  assets: jest.Mock
  claimableBalances: jest.Mock
  /** Resets all mocks to their default implementations. Call in beforeEach. */
  reset(): void
}

/**
 * Creates a fresh, isolated Horizon.Server mock for a single test.
 *
 * Each call returns a new object with independent jest.fn() instances —
 * no shared singleton, no failure state leakage between tests.
 *
 * The old mockHorizonServer singleton had a shouldThrow field that every
 * test in a file shared with no reset mechanism.  Use this factory instead:
 *
 * @example
 * let server: MockHorizonServerInstance
 * beforeEach(() => { server = createMockHorizonServer() })
 *
 * it("handles 404", async () => {
 *   server.loadAccount.mockRejectedValueOnce(notFoundError())
 *   ...
 * })
 */
export function createMockHorizonServer(
  overrides: MockHorizonServerOverrides = {}
): MockHorizonServerInstance {
  const txBuilder = createCollectionBuilder()
  const payBuilder = createCollectionBuilder()
  const opBuilder = createCollectionBuilder()
  const claimBuilder = createCollectionBuilder()
  const offerBuilder = createCollectionBuilder()

  const server: MockHorizonServerInstance = {
    loadAccount: jest.fn().mockResolvedValue(mockAccountData),
    submitTransaction: jest.fn().mockResolvedValue(mockSubmitResponse),
    fetchBaseFee: jest.fn().mockResolvedValue(100),
    transactions: jest.fn().mockReturnValue(txBuilder),
    payments: jest.fn().mockReturnValue(payBuilder),
    operations: jest.fn().mockReturnValue(opBuilder),
    claimableBalances: jest.fn().mockReturnValue(claimBuilder),
    offers: jest.fn().mockReturnValue(offerBuilder),
    orderbook: jest.fn().mockResolvedValue({
      bids: [],
      asks: [],
      base: { asset_type: "native" },
      counter: { asset_type: "native" },
    }),
    strictSendPaths: jest.fn().mockResolvedValue({ records: [] }),
    strictReceivePaths: jest.fn().mockResolvedValue({ records: [] }),
    feeStats: jest.fn().mockResolvedValue({
      last_ledger: "12345",
      last_ledger_base_fee: "100",
      ledger_capacity_usage: "0.5",
      fee_charged: {
        max: "1000", min: "100", mode: "100",
        p10: "100", p20: "100", p30: "100", p40: "100", p50: "100",
        p60: "100", p70: "100", p80: "100", p90: "100", p95: "100", p99: "100",
      },
      max_fee: {
        max: "1000", min: "100", mode: "100",
        p10: "100", p20: "100", p30: "100", p40: "100", p50: "100",
        p60: "100", p70: "100", p80: "100", p90: "100", p95: "100", p99: "100",
      },
    }),
    assets: jest.fn().mockReturnValue({
      forCode: jest.fn().mockReturnThis(),
      forIssuer: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({ records: [] }),
    }),

    reset() {
      this.loadAccount.mockReset().mockResolvedValue(mockAccountData)
      this.submitTransaction.mockReset().mockResolvedValue(mockSubmitResponse)
      this.fetchBaseFee.mockReset().mockResolvedValue(100)
      this.transactions.mockReset().mockReturnValue(txBuilder)
      this.payments.mockReset().mockReturnValue(payBuilder)
      this.operations.mockReset().mockReturnValue(opBuilder)
      this.claimableBalances.mockReset().mockReturnValue(claimBuilder)
      this.offers.mockReset().mockReturnValue(offerBuilder)
    },

    ...overrides,
  }

  return server
}

// ── SorobanRpc.Server factory ─────────────────────────────────────────────────
export interface MockSorobanServerOverrides {
  simulateTransaction?: jest.Mock
  sendTransaction?: jest.Mock
  getTransaction?: jest.Mock
  getLatestLedger?: jest.Mock
}

export interface MockSorobanServerInstance {
  simulateTransaction: jest.Mock
  sendTransaction: jest.Mock
  getTransaction: jest.Mock
  getLatestLedger: jest.Mock
}

/**
 * Creates a fresh SorobanRpc.Server mock.  Same factory pattern —
 * each call returns a new object with independent jest.fn() instances.
 *
 * @example
 * const rpc = createMockSorobanServer()
 * rpc.simulateTransaction.mockResolvedValue({ error: "not found" })
 */
export function createMockSorobanServer(
  overrides: MockSorobanServerOverrides = {}
): MockSorobanServerInstance {
  return {
    simulateTransaction: jest.fn().mockResolvedValue({
      result: { retval: undefined },
      cost: { cpu_insns: "0", mem_bytes: "0" },
      latestLedger: 12345,
    }),
    sendTransaction: jest.fn().mockResolvedValue({
      status: "PENDING",
      hash: mockSubmitResponse.hash,
      latestLedger: 12345,
      latestLedgerCloseTime: "1704067200",
    }),
    getTransaction: jest.fn().mockResolvedValue({
      status: "SUCCESS",
      latestLedger: 12345,
      latestLedgerCloseTime: "1704067200",
      oldestLedger: 12300,
      oldestLedgerCloseTime: "1704063600",
      applicationOrder: 1,
      envelopeXdr: {},
      resultXdr: {},
      resultMetaXdr: {},
    }),
    getLatestLedger: jest.fn().mockResolvedValue({
      id: "abc123",
      protocolVersion: 21,
      sequence: 12345,
    }),
    ...overrides,
  }
}

// ── Backward-compatible singleton ──────────────────────────────────────────────
/**
 * Module-level singleton kept for backward compatibility with any test that
 * imports mockHorizonServer directly.
 *
 * IMPORTANT: Tests using this singleton MUST call mockHorizonServer.reset()
 * in a beforeEach block.  Failure to do so causes test state to leak.
 * Prefer createMockHorizonServer() for new tests.
 */
export const mockHorizonServer: MockHorizonServerInstance = createMockHorizonServer()

/** Backward-compatible canned error responses. */
export const mockServerResponses = {
  accountFound: mockAccountData,
  accountNotFound: new Error("Request failed with status code 404"),
  transactionFound: mockTransactionRecord,
  transactionNotFound: { response: { status: 404 } },
  networkError: new Error("Network Error"),
}

// ── Horizon namespace (mocked boundary) ────────────────────────────────────────
/**
 * `new Horizon.Server(url)` returns the module-level mockHorizonServer
 * singleton for backward compatibility.  Tests that need per-test isolation
 * should mock getHorizonServer() from ../utils directly.
 */
export const Horizon = {
  ...actual.Horizon,
  Server: jest.fn().mockImplementation(() => mockHorizonServer),
  HorizonApi: actual.Horizon?.HorizonApi ?? {},
}

// ── SorobanRpc namespace (mocked boundary) ─────────────────────────────────────
const _sorobanServerSingleton = createMockSorobanServer()

export const SorobanRpc = {
  ...(actual.SorobanRpc ?? {}),
  Server: jest.fn().mockImplementation(() => _sorobanServerSingleton),
  Api: actual.SorobanRpc?.Api ?? {
    isSimulationError: (r: unknown) =>
      typeof r === "object" && r !== null && "error" in r && !("result" in r),
    isSimulationSuccess: (r: unknown) =>
      typeof r === "object" && r !== null && "result" in r && !("error" in r),
    isSimulationRestore: (r: unknown) =>
      typeof r === "object" && r !== null && "restorePreamble" in r,
  },
}

// ── Keypair ────────────────────────────────────────────────────────────────────
/**
 * Keypair retains the real fromPublicKey/fromSecret so that code that parses
 * a key string still works.  Only random() is overridden to return the
 * stable throwaway testnet keypair — avoiding non-determinism in tests.
 */
export const Keypair = {
  ...actual.Keypair,
  random: jest.fn(() => ({
    publicKey: () => TESTNET_KEYPAIR.publicKey,
    secret: () => TESTNET_KEYPAIR.secret,
    sign: jest.fn((_data: Buffer) => Buffer.alloc(64)),
    verify: jest.fn(() => true),
  })),
  fromPublicKey: (key: string) => actual.Keypair.fromPublicKey(key),
  fromSecret: (secret: string) => actual.Keypair.fromSecret(secret),
}

// ── Default export ─────────────────────────────────────────────────────────────
export default {
  ...actual,
  Asset,
  Operation,
  Memo,
  Networks,
  BASE_FEE,
  StrKey,
  TransactionBuilder,
  Account,
  Contract,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
  Horizon,
  SorobanRpc,
  Keypair,
  // Fixtures
  TESTNET_ADDRESS_A,
  TESTNET_ADDRESS_B,
  TESTNET_KEYPAIR,
  mockAccountRecord,
  mockAccountData,
  mockSubmitResponse,
  mockTransactionRecord,
  mockHorizonServer,
  mockServerResponses,
  // Factories
  createMockHorizonServer,
  createMockSorobanServer,
  createCollectionBuilder,
}
