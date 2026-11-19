import type { PathPaymentOptions, WalletState } from "../types"
import type { PathPaymentRuntime } from "./pathPayment"

const source = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const destination = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
let strictSendOperations: Record<string, unknown>[] = []
let strictReceiveOperations: Record<string, unknown>[] = []
let submitResponse: Record<string, unknown> = {}
let submitError: unknown = null
let signOptions: Record<string, unknown> | null = null

jest.mock("@stellar/stellar-sdk", () => {
  class MockAsset {
    constructor(
      public readonly code: string,
      public readonly issuer?: string
    ) {}

    static native() {
      return new MockAsset("XLM")
    }
  }

  class MockTransactionBuilder {
    addOperation() {
      return this
    }

    addMemo() {
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
    Asset: MockAsset,
    TransactionBuilder: MockTransactionBuilder,
    BASE_FEE: "100",
    Networks: {
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    },
    Memo: { text: (value: string) => ({ value }) },
    Operation: {
      pathPaymentStrictSend: (operation: Record<string, unknown>) => {
        strictSendOperations.push(operation)
        return operation
      },
      pathPaymentStrictReceive: (operation: Record<string, unknown>) => {
        strictReceiveOperations.push(operation)
        return operation
      },
    },
  }
})

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  canSignTransactions: () => true,
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
    signTransaction: async (_xdr: string, options: Record<string, unknown>) => {
      signOptions = options
      return "signed-xdr"
    },
  }),
}))

import { isPathPaymentPreflightError, pathPayment } from "./pathPayment"

const usdc = { code: "USDC", issuer }
const strictSend: PathPaymentOptions = {
  mode: "strictSend",
  destination,
  sendAsset: "XLM",
  sendAmount: "100",
  destAsset: usdc,
  destMin: "24.7500000",
  path: [],
}

function connectedWallet(): WalletState {
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
  }
}

function createRuntime(): PathPaymentRuntime & { queryStore: { invalidate: jest.Mock } } {
  return {
    network: "testnet",
    networkConfig: {
      network: "testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    wallet: connectedWallet(),
    queryStore: { invalidate: jest.fn() },
  }
}

function horizonFailure(...operations: string[]) {
  return {
    response: {
      status: 400,
      data: { extras: { result_codes: { transaction: "tx_failed", operations } } },
    },
  }
}

beforeEach(() => {
  strictSendOperations = []
  strictReceiveOperations = []
  submitError = null
  submitResponse = { hash: "abc123", successful: true, ledger: 42 }
  signOptions = null
})

test("builds strict-send with the exact bound, signs on runtime network, and invalidates", async () => {
  const runtime = createRuntime()
  await expect(pathPayment(runtime, strictSend)).resolves.toMatchObject({
    hash: "abc123",
    status: "success",
  })

  expect(strictSendOperations[0]).toMatchObject({
    destination,
    sendAmount: "100",
    destMin: "24.7500000",
    path: [],
  })
  expect(signOptions).toMatchObject({
    address: source,
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
  })
  expect(runtime.queryStore.invalidate).toHaveBeenCalledWith([
    "account",
    "https://horizon-testnet.stellar.org",
    "testnet",
    source,
  ])
})

test("builds strict-receive with sendMax and destAmount", async () => {
  await pathPayment(createRuntime(), {
    mode: "strictReceive",
    destination,
    sendAsset: "XLM",
    sendMax: "105",
    destAsset: usdc,
    destAmount: "25",
  })

  expect(strictReceiveOperations[0]).toMatchObject({ sendMax: "105", destAmount: "25" })
  expect(strictSendOperations).toHaveLength(0)
})

test("rejects missing bounds before building or signing", async () => {
  const invalid = { ...strictSend, destMin: "" } as PathPaymentOptions
  const error = await pathPayment(createRuntime(), invalid).catch(caught => caught)

  expect(error).toMatchObject({ code: "VALIDATION_ERROR" })
  expect(isPathPaymentPreflightError(error)).toBe(true)
  expect(strictSendOperations).toHaveLength(0)
  expect(signOptions).toBeNull()
})

test("rejects disconnected and wrong-network wallets before transaction work", async () => {
  const disconnected = createRuntime()
  disconnected.wallet = { ...connectedWallet(), connected: false, address: null }
  await expect(pathPayment(disconnected, strictSend)).rejects.toMatchObject({
    code: "WALLET_NOT_CONNECTED",
  })

  const mismatch = createRuntime()
  mismatch.wallet = { ...connectedWallet(), walletNetwork: "mainnet" }
  await expect(pathPayment(mismatch, strictSend)).rejects.toMatchObject({
    code: "WRONG_NETWORK",
  })
  expect(strictSendOperations).toHaveLength(0)
})

test("classifies slippage failures and does not invalidate cache", async () => {
  submitError = horizonFailure("op_under_dest_min")
  const runtime = createRuntime()

  await expect(pathPayment(runtime, strictSend)).rejects.toMatchObject({
    code: "TRANSACTION_FAILED",
    message: expect.stringMatching(/rate moved.*destMin/),
  })
  expect(runtime.queryStore.invalidate).not.toHaveBeenCalled()
})

test("preserves Horizon's unsuccessful status", async () => {
  submitResponse = { hash: "failed-hash", successful: false, ledger: 43 }
  await expect(pathPayment(createRuntime(), strictSend)).resolves.toMatchObject({
    hash: "failed-hash",
    status: "failed",
    ledger: 43,
  })
})
