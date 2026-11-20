import { Account, Networks, TransactionBuilder } from "@stellar/stellar-sdk"
import { createOffer, updateOffer, cancelOffer, type ManageOfferRuntime } from "./manageOffer"
import { getHorizonServer } from "../utils"
import { getWalletAdapter } from "../wallets"
import { onlineManager } from "../runtime/onlineManager"
import { NETWORK_CONFIGS, type ManageOfferParams } from "../types"
import { accountKey } from "../cache/keys"
jest.mock("../utils", () => ({ ...jest.requireActual("../utils"), getHorizonServer: jest.fn() }))
jest.mock("../wallets", () => ({ getWalletAdapter: jest.fn() }))
const source = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
const issuer = "GDS3CXXLBJO6MK3W7HQ777S6Y4MNBCBR7BHKV44FS2QC5QKQPZ5EF4OO"
const params: ManageOfferParams = { selling: "XLM", buying: { code: "USD", issuer }, amount: "3", price: { n: 1, d: 2 }, side: "buy" }
const sign = jest.fn(async (xdr: string) => xdr)
const submit = jest.fn()
const lookup = jest.fn()
const invalidate = jest.fn()
let runtime: ManageOfferRuntime
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(onlineManager, "isOnline").mockReturnValue(true)
  runtime = { network: "testnet", networkConfig: NETWORK_CONFIGS.testnet, wallet: {
    connected: true, connecting: false, address: source, wallet: "freighter", network: "testnet", walletName: "Freighter", error: null, walletNetwork: "testnet", walletNetworkPassphrase: Networks.TESTNET,
  }, queryStore: { invalidate } }
  ;(getWalletAdapter as jest.Mock).mockReturnValue({ signTransaction: sign })
  ;(getHorizonServer as jest.Mock).mockReturnValue({ loadAccount: async () => new Account(source, "123"), fetchBaseFee: async () => 100, submitTransaction: submit, offers: () => ({ offer: lookup }) })
  lookup.mockReturnValue({ call: async () => ({ selling: { asset_type: "native" }, buying: { asset_type: "credit_alphanum4", asset_code: "USD", asset_issuer: issuer }, price_r: { n: 1, d: 2 } }) })
  submit.mockResolvedValue({ hash: "offer", successful: true, ledger: 7 })
})
afterEach(() => jest.restoreAllMocks())
test("buy/update preserve operation fields and invalidate the account", async () => {
  await updateOffer(runtime, "42", params)
  const tx = TransactionBuilder.fromXDR(sign.mock.calls[0][0], Networks.TESTNET)
  expect(tx.operations[0]).toMatchObject({ type: "manageBuyOffer", buyAmount: "3.0000000", offerId: "42" })
  expect(sign).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ network: "testnet", networkPassphrase: Networks.TESTNET }))
  expect(invalidate).toHaveBeenCalledWith(accountKey(runtime.networkConfig.horizonUrl, "testnet", source))
})
test("cancel looks up the original assets and submits amount zero", async () => {
  await cancelOffer(runtime, "42")
  expect(lookup).toHaveBeenCalledWith("42")
  const tx = TransactionBuilder.fromXDR(sign.mock.calls[0][0], Networks.TESTNET)
  expect(tx.operations[0]).toMatchObject({ type: "manageSellOffer", amount: "0.0000000", offerId: "42" })
})
test.each(["", "0"])("invalid id %s never fetches or signs", async id => {
  await expect(updateOffer(runtime, id, params)).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  await expect(cancelOffer(runtime, id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  expect(lookup).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
})
test("offline cancellation never fetches or signs", async () => {
  ;(onlineManager.isOnline as jest.Mock).mockReturnValue(false)
  await expect(cancelOffer(runtime, "42")).rejects.toMatchObject({ code: "NETWORK_ERROR" })
  expect(lookup).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
})
test("invalid amounts, prices and identical assets never sign", async () => {
  for (const changes of [{ amount: "0" }, { price: "-1" }, { buying: "XLM" as const }]) {
    await expect(createOffer(runtime, { ...params, ...changes })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  }
  expect(sign).not.toHaveBeenCalled()
})
test("signature rejection and submission rejection keep typed errors", async () => {
  sign.mockRejectedValueOnce(new Error("User declined"))
  await expect(createOffer(runtime, params)).rejects.toMatchObject({ code: "WALLET_REQUEST_REJECTED" })
  submit.mockRejectedValueOnce({ response: { data: { extras: { result_codes: { operations: ["op_low_reserve"] } } } } })
  await expect(createOffer(runtime, params)).rejects.toMatchObject({ code: "LOW_RESERVE" })
  expect(invalidate).not.toHaveBeenCalled()
})
test("504 exposes the hash and unsuccessful responses preserve failed status", async () => {
  submit.mockRejectedValueOnce({ response: { status: 504 } })
  await expect(createOffer(runtime, params)).rejects.toMatchObject({ code: "TX_TIMEOUT", hash: expect.stringMatching(/^[a-f0-9]{64}$/) })
  submit.mockResolvedValueOnce({ hash: "bad", successful: false, ledger: 8 })
  await expect(createOffer(runtime, params)).resolves.toEqual({ hash: "bad", status: "failed", ledger: 8 })
  expect(invalidate).not.toHaveBeenCalled()
})
