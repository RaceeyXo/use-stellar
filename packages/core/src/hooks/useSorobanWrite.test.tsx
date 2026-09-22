// packages/core/src/hooks/useSorobanWrite.test.tsx

import { renderHook, act } from "@testing-library/react"
import { useSorobanWrite } from "./useSorobanWrite"
import { rpc, xdr, TransactionBuilder, Networks, SorobanDataBuilder } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"

jest.mock("../context/StellarProvider")
jest.mock("../utils")
// getWalletAdapter lives in ../wallets; automock it so tests can drive it.
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

/** A valid testnet contract id — the hook validates strkey before invoking. */
const TEST_CONTRACT_ID = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR"

describe("useSorobanWrite", () => {
  const mockWallet = {
    connected: true,
    address: "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5",
    wallet: "test-wallet",
    walletNetwork: "testnet",
  }

  const mockNetworkConfig = {
    network: "testnet",
    sorobanUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
  }

  const mockSignTransaction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(isBrowser as jest.Mock).mockReturnValue(true)
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: mockWallet,
    })
    ;(getHorizonServer as jest.Mock).mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({ sequence: "123" }),
    })
    ;(getWalletAdapter as jest.Mock).mockReturnValue({
      signTransaction: mockSignTransaction,
    })

    const mockAssembledTx = {
      toXDR: () => "mock-xdr",
    }
    mockAssembleTransaction.mockReturnValue({
      build: () => mockAssembledTx,
    })

    mockSignTransaction.mockResolvedValue("mock-signed-xdr")

    jest.spyOn(TransactionBuilder, "fromXDR").mockReturnValue({
      toXDR: () => "mock-signed-xdr",
    } as unknown as ReturnType<typeof TransactionBuilder.fromXDR>)
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it("completes full simulate -> assemble -> sign -> send -> poll flow", async () => {
    mockSimulateTransaction.mockResolvedValue({
      // Built through the SDK's own builder rather than hand-assembled XDR:
      // `xdr.ExtensionPoint`'s declared constructor and its runtime shape
      // disagree, and a fixture should not depend on which one wins.
      transactionData: new SorobanDataBuilder().build(),
      minResourceFee: "100",
      events: [],
      results: [
        {
          xdr: xdr.ScVal.scvI32(42).toXDR("base64"),
        },
      ],
    })

    jest.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true)
    jest.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false)
    jest.spyOn(rpc.Api, "isSimulationRestore").mockReturnValue(false)

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "mock-hash",
    })

    mockGetTransaction
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.NOT_FOUND,
      })
      .mockResolvedValueOnce({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
        returnValue: xdr.ScVal.scvI32(42),
      })

    const { result } = renderHook(() => useSorobanWrite<number>())

    let invokeResult: { hash: string; result: number } | undefined
    await act(async () => {
      invokeResult = await result.current.invoke({
        contractId: TEST_CONTRACT_ID,
        method: "add",
        args: [xdr.ScVal.scvI32(1), xdr.ScVal.scvI32(2)],
      })
    })

    expect(mockAssembleTransaction).toHaveBeenCalled()
    expect(mockSignTransaction).toHaveBeenCalled()
    expect(mockSendTransaction).toHaveBeenCalled()
    expect(mockGetTransaction).toHaveBeenCalledWith("mock-hash")
    expect(invokeResult?.hash).toBe("mock-hash")
    expect(invokeResult?.result).toBe(42) // Safely decoded via scValToNative
  })

  it("surfaces RESTORE_PREAMBLE_REQUIRED error for archived state", async () => {
    jest.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false)
    jest.spyOn(rpc.Api, "isSimulationRestore").mockReturnValue(true)

    const { result } = renderHook(() => useSorobanWrite())

    await act(async () => {
      await expect(
        result.current.invoke({ contractId: TEST_CONTRACT_ID, method: "add" })
      ).rejects.toThrow(/archived/)
    })

    expect(result.current.error?.code).toBe("RESTORE_PREAMBLE_REQUIRED")
  })

  it("surfaces TX_TIMEOUT on poll timeout and attaches the hash", async () => {
    jest.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true)
    jest.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false)
    jest.spyOn(rpc.Api, "isSimulationRestore").mockReturnValue(false)

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "mock-hash-timeout",
    })

    mockGetTransaction.mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.NOT_FOUND,
    })

    const { result } = renderHook(() => useSorobanWrite())

    await act(async () => {
      await expect(
        result.current.invoke({ contractId: TEST_CONTRACT_ID, method: "add", timeout: 100 })
      ).rejects.toThrow(/timed out/)
    })

    expect(result.current.error?.code).toBe("TX_TIMEOUT")
    expect(result.current.error?.hash).toBe("mock-hash-timeout")
  })

  it("fails early if wallet is not connected", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: { ...mockWallet, connected: false },
    })

    const { result } = renderHook(() => useSorobanWrite())

    await act(async () => {
      await expect(
        result.current.invoke({ contractId: TEST_CONTRACT_ID, method: "add" })
      ).rejects.toThrow(/connected/)
    })
  })
})
