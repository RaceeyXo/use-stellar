// packages/core/src/hooks/useCreateAccount.test.tsx

import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useCreateAccount } from "./useCreateAccount"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, getWalletAdapter, isBrowser } from "../utils"
import { TransactionBuilder, Operation } from "@stellar/stellar-sdk"

jest.mock("../context/StellarProvider")
jest.mock("../utils")

// Mock @stellar/stellar-sdk to inspect the operation passed to the builder
jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk")
  return {
    ...original,
    Operation: {
      ...original.Operation,
      createAccount: jest.fn().mockReturnValue("createAccount_op"),
    }
  }
})

describe("useCreateAccount", () => {
  const TESTNET_SOURCE = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASUIYIC7FEM"
  const TESTNET_DESTINATION = "GDRW7AJYGBJPJB5SPIZENZZZ45EIZHJOZDLUPZHX6X67KAGM3K3NX4VN"
  const CONTRACT_ADDRESS = "CCW67TSZV3YXZF6E7YF6XY7XY7XY7XY7XY7XY7XY7XY7XY7XY7XY7XY"

  const mockWallet = { connected: true, address: TESTNET_SOURCE, wallet: "freighter", walletNetwork: "testnet" }
  const mockNetworkConfig = { network: "testnet", horizonUrl: "https://horizon-testnet.stellar.org", networkPassphrase: "Test SDF Network ; September 2015" }
  
  const mockSubmitTransaction = jest.fn()
  const mockLoadAccount = jest.fn()
  const mockLedgersCall = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(isBrowser as jest.Mock).mockReturnValue(true)
    ;(useStellarContext as jest.Mock).mockReturnValue({ network: "testnet", networkConfig: mockNetworkConfig, wallet: mockWallet })
    ;(getHorizonServer as jest.Mock).mockReturnValue({
      loadAccount: mockLoadAccount,
      feeStats: jest.fn().mockResolvedValue({ last_ledger_base_fee: "100" }),
      submitTransaction: mockSubmitTransaction,
      ledgers: () => ({ order: () => ({ limit: () => ({ call: mockLedgersCall }) }) })
    })
    ;(getWalletAdapter as jest.Mock).mockReturnValue({ signTransaction: jest.fn().mockResolvedValue("signed-xdr") })
    jest.spyOn(TransactionBuilder, "fromXDR").mockReturnValue({ toXDR: () => "signed-xdr" } as any)
  })

  it("creates an account successfully when destination is not found and balance meets reserve", async () => {
    mockLoadAccount.mockImplementation((addr) => {
      if (addr === TESTNET_DESTINATION) return Promise.reject({ response: { status: 404 } })
      return Promise.resolve({ sequence: "123" }) // source account
    })
    mockLedgersCall.mockResolvedValue({ records: [{ base_reserve_in_stroops: "5000000" }] }) // 0.5 XLM (so min is 1.0 XLM)
    mockSubmitTransaction.mockResolvedValue({ hash: "tx_hash", successful: true, ledger: 100 })

    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })
    })

    expect(Operation.createAccount).toHaveBeenCalledWith({ destination: TESTNET_DESTINATION, startingBalance: "2" })
    expect(result.current.result?.status).toBe("success")
  })

  it("fails early if wallet is not connected", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet", networkConfig: mockNetworkConfig, wallet: { ...mockWallet, connected: false }
    })
    const { result } = renderHook(() => useCreateAccount())
    
    await act(async () => {
      await expect(result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })).rejects.toThrow()
    })
    expect(result.current.error?.name).toBe("WALLET_NOT_CONNECTED")
  })

  it("rejects an invalid destination address", async () => {
    const { result } = renderHook(() => useCreateAccount())
    
    await act(async () => {
      await expect(result.current.createAccount({ destination: "invalid_string", startingBalance: "2" })).rejects.toThrow()
    })
    expect(result.current.error?.name).toBe("VALIDATION_ERROR")
  })

  it("rejects a contract address (C...) as a destination", async () => {
    const { result } = renderHook(() => useCreateAccount())
    
    await act(async () => {
      await expect(result.current.createAccount({ destination: CONTRACT_ADDRESS, startingBalance: "2" })).rejects.toThrow()
    })
    expect(result.current.error?.name).toBe("VALIDATION_ERROR")
  })

  it("rejects creating an account that already exists on the ledger", async () => {
    mockLoadAccount.mockResolvedValue({ sequence: "123" }) // resolving means it exists
    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })).rejects.toThrow()
    })
    expect(result.current.error?.name).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/already exists/)
  })

  it("rejects a startingBalance below the dynamically fetched base reserve requirement", async () => {
    mockLoadAccount.mockImplementation((addr) => {
      if (addr === TESTNET_DESTINATION) return Promise.reject({ response: { status: 404 } })
      return Promise.resolve({ sequence: "123" })
    })
    // Simulate a network upgrade to a higher reserve, e.g., 20M stroops (2 XLM, meaning min balance is 4 XLM)
    mockLedgersCall.mockResolvedValue({ records: [{ base_reserve_in_stroops: "20000000" }] })

    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "3" })).rejects.toThrow()
    })
    
    expect(result.current.error?.name).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/4 XLM/) // Ensure the dynamic calculation is named
  })

  it("handles submit failure and resets state", async () => {
    mockLoadAccount.mockImplementation((addr) => {
      if (addr === TESTNET_DESTINATION) return Promise.reject({ response: { status: 404 } })
      return Promise.resolve({ sequence: "123" })
    })
    mockLedgersCall.mockResolvedValue({ records: [{ base_reserve_in_stroops: "5000000" }] })
    mockSubmitTransaction.mockRejectedValue(new Error("Network failed"))

    const { result } = renderHook(() => useCreateAccount())

    await act(async () => {
      await expect(result.current.createAccount({ destination: TESTNET_DESTINATION, startingBalance: "2" })).rejects.toThrow()
    })
    
    expect(result.current.error?.name).toBe("UNKNOWN")

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
  })
})