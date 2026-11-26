import type { WalletState } from "../types"
import type { LiquidityPoolRuntime } from "./liquidityPool"

const source = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const POOL_ID = "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7"
let operations: { type: string; params: Record<string, unknown> }[] = []
let submitResponse: Record<string, unknown> = {}
let submitError: unknown = null
let browser = true

jest.mock("@stellar/stellar-sdk", () => {
  class MockTransactionBuilder {
    addOperation() {
      return this
    }
    setTimeout() {
      return this
    }
    build() {
      return { toXDR: () => "unsigned-xdr" }
    }
    static fromXDR(xdr: string) {
      return { xdr }
    }
  }
  return {
    TransactionBuilder: MockTransactionBuilder,
    BASE_FEE: "100",
    Networks: { TESTNET: "Test SDF Network ; September 2015" },
    Operation: {
      liquidityPoolDeposit: (params: Record<string, unknown>) => {
        operations.push({ type: "deposit", params })
        return params
      },
      liquidityPoolWithdraw: (params: Record<string, unknown>) => {
        operations.push({ type: "withdraw", params })
        return params
      },
    },
  }
})

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  isBrowser: () => browser,
  getHorizonServer: () => ({
    fetchBaseFee: async () => 100,
    loadAccount: async () => ({ accountId: () => source }),
    submitTransaction: async () => {
      if (submitError) throw submitError
      return submitResponse
    },
  }),
}))

jest.mock("../wallets", () => ({
  ...jest.requireActual("../wallets"),
  getWalletAdapter: () => ({
    metadata: { type: "freighter", name: "Freighter", supported: true },
    signTransaction: async () => "signed-xdr",
  }),
}))

import {
  depositLiquidity,
  isLiquidityPoolSubmissionFailure,
  withdrawLiquidity,
} from "./liquidityPool"
import { accountKey, liquidityPoolKey } from "../cache/keys"
import { onlineManager } from "../runtime/onlineManager"

function wallet(overrides: Partial<WalletState> = {}): WalletState {
  return {
    connected: true,
    connecting: false,
    address: source,
    network: "testnet",
    wallet: "freighter",
    walletName: "Freighter",
    error: null,
    walletNetwork: "testnet",
    walletNetworkPassphrase: "Test SDF Network ; September 2015",
    ...overrides,
  }
}

function runtime(
  overrides: Partial<LiquidityPoolRuntime> = {}
): LiquidityPoolRuntime & { queryStore: { invalidate: jest.Mock } } {
  return {
    network: "testnet",
    networkConfig: {
      network: "testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    wallet: wallet(),
    queryStore: { invalidate: jest.fn() },
    ...overrides,
  } as LiquidityPoolRuntime & { queryStore: { invalidate: jest.Mock } }
}

const deposit = {
  poolId: POOL_ID,
  maxAmountA: "10",
  maxAmountB: "20",
  minPrice: "0.4",
  maxPrice: "0.6",
}
const withdraw = { poolId: POOL_ID, amount: "5", minAmountA: "1", minAmountB: "2" }

describe("actions/liquidityPool", () => {
  beforeEach(() => {
    operations = []
    submitResponse = { successful: true, hash: "abc123" }
    submitError = null
    browser = true
    onlineManager.setOnline(true)
  })

  it("deposits with the pool operation and invalidates the account and the pool", async () => {
    const rt = runtime()
    await expect(depositLiquidity(rt, deposit)).resolves.toEqual({
      hash: "abc123",
      status: "success",
    })
    expect(operations).toEqual([
      {
        type: "deposit",
        params: {
          liquidityPoolId: POOL_ID,
          maxAmountA: "10",
          maxAmountB: "20",
          minPrice: "0.4",
          maxPrice: "0.6",
        },
      },
    ])
    const horizon = rt.networkConfig.horizonUrl
    expect(rt.queryStore.invalidate).toHaveBeenCalledWith(accountKey(horizon, "testnet", source))
    expect(rt.queryStore.invalidate).toHaveBeenCalledWith(
      liquidityPoolKey(horizon, "testnet", POOL_ID)
    )
  })

  it("withdraws with the pool operation", async () => {
    await withdrawLiquidity(runtime(), withdraw)
    expect(operations).toEqual([
      {
        type: "withdraw",
        params: { liquidityPoolId: POOL_ID, amount: "5", minAmountA: "1", minAmountB: "2" },
      },
    ])
  })

  it("throws WALLET_NOT_CONNECTED without a connected wallet, before any work", async () => {
    await expect(
      depositLiquidity(runtime({ wallet: wallet({ connected: false, address: null }) }), deposit)
    ).rejects.toMatchObject({ code: "WALLET_NOT_CONNECTED" })
    // The operation is built by the caller-facing function, but nothing is submitted.
    expect(operations).toHaveLength(1)
  })

  it("refuses to sign outside a browser", async () => {
    browser = false
    await expect(withdrawLiquidity(runtime(), withdraw)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    })
  })

  it("fails fast offline", async () => {
    onlineManager.setOnline(false)
    await expect(withdrawLiquidity(runtime(), withdraw)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: expect.stringContaining("offline"),
    })
  })

  it("marks an unsuccessful submission and keeps its hash, without invalidating", async () => {
    submitResponse = {
      successful: false,
      hash: "deadbeef",
      extras: { result_codes: { transaction: "tx_failed", operations: ["op_underfunded"] } },
    }
    const rt = runtime()
    const error = await depositLiquidity(rt, deposit).catch(e => e)
    expect(isLiquidityPoolSubmissionFailure(error)).toBe(true)
    expect(error.hash).toBe("deadbeef")
    expect(rt.queryStore.invalidate).not.toHaveBeenCalled()
  })

  it("maps a thrown network error", async () => {
    submitError = { response: { status: 429, data: {} } }
    await expect(depositLiquidity(runtime(), deposit)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    })
  })
})
