// packages/core/src/hooks/useCreateAccount.test.tsx

import { renderHook, act } from "@testing-library/react"
import { useCreateAccount } from "./useCreateAccount"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"
import { TransactionBuilder, Operation } from "@stellar/stellar-sdk"

jest.mock("../context/StellarProvider")
jest.mock("../utils")
// getWalletAdapter lives in ../wallets; automock it so tests can drive it.
jest.mock("../wallets")

// Spy on Operation.createAccount so the test can inspect the arguments the hook
// passes, while still delegating to the real implementation — TransactionBuilder
// only accepts a real xdr.Operation, so a stand-in return value breaks build().
jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk")
  return {
    ...original,
    Operation: {
      ...original.Operation,
      // Called through `original.Operation` rather than passed as a bare
      // reference: the real implementation uses `this.isValidAmount`, which the
      // object spread above does not carry over.
      createAccount: jest.fn((...args: unknown[]) => original.Operation.createAccount(...args)),
    },
  }
})

describe("useCreateAccount", () => {
  const TESTNET_SOURCE = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
  const TESTNET_DESTINATION = "GDS3CXXLBJO6MK3W7HQ777S6Y4MNBCBR7BHKV44FS2QC5QKQPZ5EF4OO"
  const CONTRACT_ADDRESS = "CCW67TSZV3YXZF6E7YF6XY7XY7XY7XY7XY7XY7XY7XY7XY7XY7XY7XY"

  const mockWallet = {
    connected: true,
    address: TESTNET_SOURCE,
    wallet: "freighter",
    walletNetwork: "testnet",
  }
  const mockNetworkConfig = {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  }

  const mockSubmitTransaction = jest.fn()
  const mockLoadAccount = jest.fn()
  const mockLedgersCall = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(isBrowser as jest.Mock).mockReturnValue(true)
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: mockWallet,
    })
    ;(getHorizonServer as jest.Mock).mockReturnValue({
      loadAccount: mockLoadAccount,
      feeStats: jest.fn().mockResolvedValue({ last_ledger_base_fee: "100" }),
      submitTransaction: mockSubmitTransaction,
      ledgers: () => ({ order: () => ({ limit: () => ({ call: mockLedgersCall }) }) }),
    })
    ;(getWalletAdapter as jest.Mock).mockReturnValue({
      signTransaction: jest.fn().mockResolvedValue("signed-xdr"),
    })
    jest.spyOn(TransactionBuilder, "fromXDR").mockReturnValue({
      toXDR: () => "signed-xdr",
    } as unknown as ReturnType<typeof TransactionBuilder.fromXDR>)
  })

  it("creates an account successfully when destination is not found and balance meets reserve", async () => {
    mockLoadAccount.mockImplementation(addr => {
      if (addr === TESTNET_DESTINATION) return Promise.reject({ response: { status: 404 } })
      // Horizon's AccountResponse implements the Account interface that
      // TransactionBuilder requires, so the double has to as well.
      return Promise.resolve({
        sequence: "123",
        accountId: () => TESTNET_SOURCE,
        sequenceNumber: () => "123",
        incrementSequenceNumber: jest.fn(),
      })
    })
    mockLedgersCall.mockResolvedValue({ records: [{ base_reserve_in_stroops: "5000000" }] }) // 0.5 XLM (so min is 1.0 XLM)
    mockSubmitTransaction.mockResolvedValue({ hash: "tx_hash", successful: true, ledger: 100 })

    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })
    })

    expect(Operation.createAccount).toHaveBeenCalledWith({
      destination: TESTNET_DESTINATION,
      startingBalance: "2",
    })
    expect(result.current.result?.status).toBe("success")
  })

  it("fails early if wallet is not connected", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: { ...mockWallet, connected: false },
    })
    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(
        result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })
      ).rejects.toThrow()
    })
    expect(result.current.error?.code).toBe("WALLET_NOT_CONNECTED")
  })

  it("rejects an invalid destination address", async () => {
    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(
        result.current.createAccount({ destination: "invalid_string", startingBalance: "2" })
      ).rejects.toThrow()
    })
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  })

  it("rejects a contract address (C...) as a destination", async () => {
    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(
        result.current.createAccount({ destination: CONTRACT_ADDRESS, startingBalance: "2" })
      ).rejects.toThrow()
    })
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  })

  it("rejects creating an account that already exists on the ledger", async () => {
    mockLoadAccount.mockResolvedValue({ sequence: "123" }) // resolving means it exists
    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(
        result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })
      ).rejects.toThrow()
    })
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/already exists/)
  })

  it("rejects a startingBalance below the dynamically fetched base reserve requirement", async () => {
    mockLoadAccount.mockImplementation(addr => {
      if (addr === TESTNET_DESTINATION) return Promise.reject({ response: { status: 404 } })
      return Promise.resolve({ sequence: "123" })
    })
    // Simulate a network upgrade to a higher reserve, e.g., 20M stroops (2 XLM, meaning min balance is 4 XLM)
    mockLedgersCall.mockResolvedValue({ records: [{ base_reserve_in_stroops: "20000000" }] })

    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(
        result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "3" })
      ).rejects.toThrow()
    })

    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/4 XLM/) // Ensure the dynamic calculation is named
  })

  it("handles submit failure and resets state", async () => {
    mockLoadAccount.mockImplementation(addr => {
      if (addr === TESTNET_DESTINATION) return Promise.reject({ response: { status: 404 } })
      return Promise.resolve({ sequence: "123" })
    })
    mockLedgersCall.mockResolvedValue({ records: [{ base_reserve_in_stroops: "5000000" }] })
    mockSubmitTransaction.mockRejectedValue(new Error("Network failed"))

    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(
        result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })
      ).rejects.toThrow()
    })

    expect(result.current.error?.code).toBe("UNKNOWN")

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
  })
})
