import { Account, TransactionBuilder, Networks } from "@stellar/stellar-sdk"
import { createAccount, type CreateAccountRuntime } from "./createAccount"
import { getHorizonServer } from "../utils"
import { getWalletAdapter } from "../wallets"
import { onlineManager } from "../runtime/onlineManager"
import { accountKey } from "../cache/keys"
import { NETWORK_CONFIGS } from "../types"

jest.mock("../utils", () => ({ ...jest.requireActual("../utils"), getHorizonServer: jest.fn() }))
jest.mock("../wallets", () => ({ getWalletAdapter: jest.fn() }))
const source = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
const destination = "GDS3CXXLBJO6MK3W7HQ777S6Y4MNBCBR7BHKV44FS2QC5QKQPZ5EF4OO"
const submit = jest.fn()
const sign = jest.fn(async (xdr: string) => xdr)
const invalidate = jest.fn()
let runtime: CreateAccountRuntime
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(onlineManager, "isOnline").mockReturnValue(true)
  runtime = {
    network: "testnet",
    networkConfig: NETWORK_CONFIGS.testnet,
    wallet: {
      connected: true,
      connecting: false,
      address: source,
      wallet: "freighter",
      network: "testnet",
      walletName: "Freighter",
      error: null,
      walletNetwork: "testnet",
      walletNetworkPassphrase: Networks.TESTNET,
    },
    queryStore: { invalidate },
    transactionTimeout: 60,
  }
  ;(getWalletAdapter as jest.Mock).mockReturnValue({ signTransaction: sign })
  ;(getHorizonServer as jest.Mock).mockReturnValue({
    loadAccount: jest.fn(async (address: string) => {
      if (address === destination) throw { response: { status: 404 } }
      return new Account(source, "123")
    }),
    ledgers: () => ({
      order: () => ({
        limit: () => ({
          call: async () => ({ records: [{ base_reserve_in_stroops: "5000000" }] }),
        }),
      }),
    }),
    feeStats: async () => ({ last_ledger_base_fee: "100" }),
    submitTransaction: submit,
  })
  submit.mockResolvedValue({ hash: "created", successful: true, ledger: 12 })
})
afterEach(() => jest.restoreAllMocks())
const options = { destination, startingBalance: "2" }
test("signs the resolved network, respects fees/timeout and invalidates both accounts", async () => {
  await expect(createAccount(runtime, { ...options, fee: "250" })).resolves.toEqual({
    hash: "created",
    status: "success",
    ledger: 12,
  })
  const tx = TransactionBuilder.fromXDR(sign.mock.calls[0][0], Networks.TESTNET)
  expect(tx.fee).toBe("250")
  expect(sign).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      network: "testnet",
      networkPassphrase: Networks.TESTNET,
      address: source,
    })
  )
  expect(invalidate).toHaveBeenCalledWith(
    accountKey(runtime.networkConfig.horizonUrl, "testnet", source)
  )
  expect(invalidate).toHaveBeenCalledWith(
    accountKey(runtime.networkConfig.horizonUrl, "testnet", destination)
  )
})
test("offline and wrong-network guards never sign", async () => {
  ;(onlineManager.isOnline as jest.Mock).mockReturnValue(false)
  await expect(createAccount(runtime, options)).rejects.toMatchObject({ code: "NETWORK_ERROR" })
  expect(sign).not.toHaveBeenCalled()
  ;(onlineManager.isOnline as jest.Mock).mockReturnValue(true)
  runtime.wallet.walletNetwork = "futurenet"
  await expect(createAccount(runtime, options)).rejects.toMatchObject({ code: "WRONG_NETWORK" })
})
test("signature rejection preserves its error code and leaves caches fresh", async () => {
  sign.mockRejectedValueOnce(new Error("User rejected request"))
  await expect(createAccount(runtime, options)).rejects.toMatchObject({
    code: "WALLET_REQUEST_REJECTED",
  })
  expect(submit).not.toHaveBeenCalled()
  expect(invalidate).not.toHaveBeenCalled()
})
test("504 carries the transaction hash without invalidating accounts", async () => {
  submit.mockRejectedValueOnce({ response: { status: 504 } })
  await expect(createAccount(runtime, options)).rejects.toMatchObject({
    code: "TX_TIMEOUT",
    hash: expect.stringMatching(/^[a-f0-9]{64}$/),
  })
  expect(invalidate).not.toHaveBeenCalled()
})
test("an unsuccessful submission preserves the legacy failed result", async () => {
  submit.mockResolvedValueOnce({ hash: "failed", successful: false, ledger: 13 })
  await expect(createAccount(runtime, options)).resolves.toEqual({
    hash: "failed",
    status: "failed",
    ledger: 13,
  })
  expect(invalidate).not.toHaveBeenCalled()
})
