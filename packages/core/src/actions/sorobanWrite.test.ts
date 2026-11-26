import { rpc, xdr, TransactionBuilder, Networks, SorobanDataBuilder } from "@stellar/stellar-sdk"
import { getHorizonServer, isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"
import { accountKey } from "../cache/keys"
import { onlineManager } from "../runtime/onlineManager"
import { invokeContract, type SorobanWriteRuntime } from "./sorobanWrite"

jest.mock("../utils")
jest.mock("../wallets")

const mockSimulateTransaction = jest.fn()
const mockSendTransaction = jest.fn()
const mockGetTransaction = jest.fn()
const mockAssembleTransaction = jest.fn()

jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk")
  return {
    ...original,
    rpc: {
      ...original.rpc,
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: mockSimulateTransaction,
        sendTransaction: mockSendTransaction,
        getTransaction: mockGetTransaction,
      })),
      assembleTransaction: (...args: unknown[]) => mockAssembleTransaction(...args),
    },
  }
})

const CONTRACT_ID = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR"
const ADDRESS = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
const mockSignTransaction = jest.fn()

function runtime(
  wallet: Partial<SorobanWriteRuntime["wallet"]> = {}
): SorobanWriteRuntime & { queryStore: { invalidate: jest.Mock } } {
  return {
    network: "testnet",
    networkConfig: {
      network: "testnet",
      sorobanUrl: "https://soroban-testnet.stellar.org",
      horizonUrl: "https://horizon-testnet.stellar.org",
      networkPassphrase: Networks.TESTNET,
    },
    wallet: {
      connected: true,
      connecting: false,
      address: ADDRESS,
      network: "testnet",
      wallet: "test-wallet",
      walletName: "Test",
      error: null,
      walletNetwork: "testnet",
      walletNetworkPassphrase: Networks.TESTNET,
      ...wallet,
    },
    queryStore: { invalidate: jest.fn() },
  }
}

function simulationOk() {
  jest.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true)
  jest.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false)
  jest.spyOn(rpc.Api, "isSimulationRestore").mockReturnValue(false)
  mockSimulateTransaction.mockResolvedValue({
    transactionData: new SorobanDataBuilder().build(),
    minResourceFee: "100",
    events: [],
    results: [{ xdr: xdr.ScVal.scvI32(42).toXDR("base64") }],
  })
}

describe("actions/sorobanWrite", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    onlineManager.setOnline(true)
    ;(isBrowser as jest.Mock).mockReturnValue(true)
    ;(getHorizonServer as jest.Mock).mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({ sequence: "123" }),
    })
    ;(getWalletAdapter as jest.Mock).mockReturnValue({ signTransaction: mockSignTransaction })
    mockAssembleTransaction.mockReturnValue({ build: () => ({ toXDR: () => "assembled-xdr" }) })
    mockSignTransaction.mockResolvedValue("signed-xdr")
    jest
      .spyOn(TransactionBuilder, "fromXDR")
      .mockReturnValue({ toXDR: () => "signed-xdr" } as unknown as ReturnType<
        typeof TransactionBuilder.fromXDR
      >)
  })

  it("simulates, assembles, signs, sends, polls, decodes, and invalidates the signer's account", async () => {
    simulationOk()
    mockSendTransaction.mockResolvedValue({ status: "PENDING", hash: "tx-hash" })
    mockGetTransaction
      .mockResolvedValueOnce({ status: rpc.Api.GetTransactionStatus.NOT_FOUND })
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: xdr.ScVal.scvI32(42),
      })
    jest.useFakeTimers({ doNotFake: ["Date"] })
    const rt = runtime()
    const pending = invokeContract<number>(rt, { contractId: CONTRACT_ID, method: "add" })
    await jest.advanceTimersByTimeAsync(2000)
    jest.useRealTimers()

    await expect(pending).resolves.toEqual({ hash: "tx-hash", result: 42 })
    expect(mockSignTransaction).toHaveBeenCalledWith("assembled-xdr", {
      address: ADDRESS,
      network: "testnet",
      networkPassphrase: Networks.TESTNET,
    })
    expect(rt.queryStore.invalidate).toHaveBeenCalledWith(
      accountKey("https://horizon-testnet.stellar.org", "testnet", ADDRESS)
    )
  })

  const guards: [string, () => void, Partial<SorobanWriteRuntime["wallet"]>, string][] = [
    [
      "not in a browser",
      () => void (isBrowser as jest.Mock).mockReturnValue(false),
      {},
      "VALIDATION_ERROR",
    ],
    ["no wallet", () => undefined, { connected: false }, "WALLET_NOT_CONNECTED"],
    ["wrong network", () => undefined, { walletNetwork: "mainnet" }, "WRONG_NETWORK"],
    ["offline", () => onlineManager.setOnline(false), {}, "NETWORK_ERROR"],
  ]
  it.each(guards)(
    "refuses before any network work when %s",
    async (_name, arrange, wallet, code) => {
      arrange()
      await expect(
        invokeContract(runtime(wallet), { contractId: CONTRACT_ID, method: "add" })
      ).rejects.toMatchObject({ code })
      expect(mockSimulateTransaction).not.toHaveBeenCalled()
    }
  )

  it("rejects an invalid contract id with VALIDATION_ERROR", async () => {
    await expect(
      invokeContract(runtime(), { contractId: "not-a-contract", method: "add" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  it("surfaces SIMULATION_FAILED and RESTORE_PREAMBLE_REQUIRED", async () => {
    jest.spyOn(rpc.Api, "isSimulationError").mockReturnValueOnce(true)
    mockSimulateTransaction.mockResolvedValue({ error: "boom" })
    await expect(
      invokeContract(runtime(), { contractId: CONTRACT_ID, method: "add" })
    ).rejects.toMatchObject({ code: "SIMULATION_FAILED" })

    jest.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false)
    jest.spyOn(rpc.Api, "isSimulationRestore").mockReturnValue(true)
    await expect(
      invokeContract(runtime(), { contractId: CONTRACT_ID, method: "add" })
    ).rejects.toMatchObject({ code: "RESTORE_PREAMBLE_REQUIRED" })
  })

  it("rethrows a rejected signature without submitting or invalidating", async () => {
    simulationOk()
    const rejected = new Error("User declined")
    mockSignTransaction.mockRejectedValue(rejected)
    const rt = runtime()
    await expect(invokeContract(rt, { contractId: CONTRACT_ID, method: "add" })).rejects.toBe(
      rejected
    )
    expect(mockSendTransaction).not.toHaveBeenCalled()
    expect(rt.queryStore.invalidate).not.toHaveBeenCalled()
  })

  it("throws TX_TIMEOUT with the hash when polling gives up", async () => {
    simulationOk()
    mockSendTransaction.mockResolvedValue({ status: "PENDING", hash: "slow-hash" })
    mockGetTransaction.mockResolvedValue({ status: rpc.Api.GetTransactionStatus.NOT_FOUND })
    await expect(
      invokeContract(runtime(), { contractId: CONTRACT_ID, method: "add", timeout: 1 })
    ).rejects.toMatchObject({ code: "TX_TIMEOUT", hash: "slow-hash" })
  })

  it("throws TRANSACTION_FAILED with the hash for a failed submission or on-chain failure", async () => {
    simulationOk()
    mockSendTransaction.mockResolvedValueOnce({
      hash: "bad-send",
      errorResult: { result: () => ({ switch: () => ({ name: "txBadSeq" }) }) },
    })
    await expect(
      invokeContract(runtime(), { contractId: CONTRACT_ID, method: "add" })
    ).rejects.toMatchObject({ code: "TRANSACTION_FAILED", hash: "bad-send" })

    mockSendTransaction.mockResolvedValueOnce({ status: "PENDING", hash: "bad-chain" })
    mockGetTransaction.mockResolvedValueOnce({
      status: rpc.Api.GetTransactionStatus.FAILED,
      resultXdr: "xdr",
    })
    await expect(
      invokeContract(runtime(), { contractId: CONTRACT_ID, method: "add" })
    ).rejects.toMatchObject({ code: "TRANSACTION_FAILED", hash: "bad-chain" })
  })
})
