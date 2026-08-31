// Mock implementation of @stellar/stellar-sdk for testing
// This prevents any real network requests during testing

/**
 * Minimal stub of the stellar-base Asset class.
 * Only the interface needed by useTrades (forAssetPair) is implemented.
 */
export class Asset {
  type: string
  code: string
  issuer: string

  constructor(code: string, issuer: string) {
    this.code = code
    this.issuer = issuer
    this.type =
      code === "XLM" ? "native" : code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12"
  }

  static native(): Asset {
    const a = new Asset("XLM", "")
    a.type = "native"
    return a
  }

  isNative(): boolean {
    return this.type === "native"
  }
}

export const TESTNET_ADDRESS_A = "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ"
export const TESTNET_ADDRESS_B = "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I"

export const mockAccountRecord = {
  id: "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
  accountId: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
  sequenceNumber: () => "1234567890123456",
  subentry_count: 2,
  thresholds: {
    low_threshold: 1,
    med_threshold: 2,
    high_threshold: 3,
  },
  signers: [
    {
      key: "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
      weight: 1,
      type: "ed25519_public_key",
    },
  ],
  balances: [
    {
      asset_type: "native",
      balance: "100.0000000",
    },
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

export const mockTransactionRecord = {
  hash: "abcdef1234567890",
  successful: true,
  ledger: 12345,
  created_at: "2024-01-01T00:00:00Z",
  fee_charged: "100",
}

// Mock server responses
export const mockServerResponses = {
  accountFound: mockAccountRecord,
  accountNotFound: new Error("Request failed with status code 404"),
  transactionFound: mockTransactionRecord,
  transactionNotFound: { response: { status: 404 } },
  networkError: new Error("Network Error"),
}

// Mock Horizon Server
export class MockHorizonServer {
  private shouldThrow: string | null = null

  // Method to configure mock behavior
  mockError(errorType: string | null) {
    this.shouldThrow = errorType
  }

  async loadAccount(_address: string) {
    if (this.shouldThrow === "accountNotFound") {
      throw mockServerResponses.accountNotFound
    }
    if (this.shouldThrow === "networkError") {
      throw mockServerResponses.networkError
    }
    return mockAccountRecord
  }

  transactions() {
    return {
      transaction: (_hash: string) => ({
        call: async () => {
          if (this.shouldThrow === "transactionNotFound") {
            throw mockServerResponses.transactionNotFound
          }
          if (this.shouldThrow === "networkError") {
            throw mockServerResponses.networkError
          }
          return mockTransactionRecord
        },
      }),
    }
  }

  claimableBalances() {
    return {
      claimant: (address: string) => ({
        call: async () => ({
          records: [
            {
              id: "000000000123abc",
              asset: "native",
              amount: "100.0000000",
              claimants: [
                {
                  destination: address,
                  predicate: { unconditional: true },
                },
              ],
              sponsor: undefined,
            },
          ],
        }),
      }),
    }
  }
}

// Create singleton mock instance
export const mockHorizonServer = new MockHorizonServer()

// Response returned by a successful Horizon submitTransaction call.
export const mockSubmitResponse = {
  hash: "c9a17a4b8f6e3d2c1a0b9f8e7d6c5b4a39281716050403020100af0e9d8c7b6a",
  successful: true,
  ledger: 25826413,
  envelope_xdr:
    "AAAAAgAAAABh/DWYVf7iXjMzDvBV1J1QgjqFyKQc5YwB4I1LcQ7mIq4AAABkADy7zwAAAAEAAAAAAAAAAAAAAAAA",
}

/**
 * Creates a fresh Horizon.Server-shaped mock for a single test. Each call
 * returns an independent instance, so success/failure state never leaks
 * between tests. `loadAccount` and `submitTransaction` are plain `jest.fn()s`
 * so tests can `mockResolvedValue(...)` / `mockRejectedValueOnce(...)` and
 * assert on call counts and arguments.
 */
export function createMockHorizonServer() {
  const loadAccount = jest.fn().mockResolvedValue({
    accountId: () => TESTNET_ADDRESS_A,
    sequenceNumber: () => "1",
  })
  const submitTransaction = jest.fn().mockResolvedValue(mockSubmitResponse)
  const fetchBaseFee = jest.fn().mockResolvedValue(100)
  return { loadAccount, submitTransaction, fetchBaseFee }
}

// Mock the Horizon namespace
export const Horizon = {
  Server: class Server {
    constructor() {
      return mockHorizonServer
    }
  },
  HorizonApi: {},
}

// Mock Keypair for integration tests
export const Keypair = {
  random: jest.fn(() => ({
    publicKey: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
    secret: () => "SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
  })),
}

// Export default mock
const stellarSdkMock = {
  Asset,
  Horizon,
  Keypair,
  mockHorizonServer,
  mockServerResponses,
  mockSubmitResponse,
  createMockHorizonServer,
  mockAccountRecord,
}

export default stellarSdkMock
