// packages/core/src/hooks/useManagerOffer.test.ts

import { renderHook, act } from "@testing-library/react"
import { useManageOffer } from "./useManagerOffer"
import { TransactionBuilder, Operation } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isIssuedAsset, isLiquidityPoolShares, isNativeAsset } from "../utils"
import { getWalletAdapter } from "../wallets"

jest.mock("../context/StellarProvider")
jest.mock("../utils")
jest.mock("../wallets")

describe("useManagerOffer", () => {
  const TESTNET_SOURCE = "GCL2KR4CDAZU3SECOM4CNJGBDYHWYD7UZ6OJMPRXZJM7TFPXHQZM4PRI"
  const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

  const XLM = "XLM" as const
  const USDC = { code: "USDC", issuer: USDC_ISSUER }

  const mockWallet = {
    connected: true,
    address: TESTNET_SOURCE,
    wallet: "test-wallet",
    walletNetwork: "testnet",
  }
  const mockNetworkConfig = {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  }

  const makeSourceAccount = () => ({
    accountId: () => TESTNET_SOURCE,
    sequenceNumber: () => "123",
    incrementSequenceNumber: jest.fn(),
    sequence: "123",
  })

  const mockSignTransaction = jest.fn()
  const mockSubmitTransaction = jest.fn()
  const mockLoadAccount = jest.fn()
  const mockOfferCall = jest.fn()
  const mockFetchBaseFee = jest.fn()

  let manageBuyOfferSpy: jest.SpyInstance
  let manageSellOfferSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: mockWallet,
    })
    ;(getHorizonServer as jest.Mock).mockReturnValue({
      loadAccount: mockLoadAccount,
      submitTransaction: mockSubmitTransaction,
      fetchBaseFee: mockFetchBaseFee,
      offers: () => ({ offer: () => ({ call: mockOfferCall }) }),
    })
    ;(isNativeAsset as unknown as jest.Mock).mockImplementation(asset => asset === "XLM")
    ;(isLiquidityPoolShares as unknown as jest.Mock).mockImplementation(
      asset => asset === "liquidity_pool_shares"
    )
    ;(isIssuedAsset as unknown as jest.Mock).mockImplementation(
      asset =>
        typeof asset === "object" &&
        asset !== null &&
        typeof asset.code === "string" &&
        asset.code.trim().length > 0 &&
        typeof asset.issuer === "string"
    )
    ;(getWalletAdapter as jest.Mock).mockReturnValue({
      signTransaction: mockSignTransaction,
    })

    mockLoadAccount.mockResolvedValue(makeSourceAccount())
    mockFetchBaseFee.mockResolvedValue(100)
    mockSignTransaction.mockResolvedValue("mock-signed-xdr")
    mockSubmitTransaction.mockResolvedValue({ hash: "tx_hash", successful: true, ledger: 100 })

    jest.spyOn(TransactionBuilder, "fromXDR").mockReturnValue({
      toXDR: () => "mock-signed-xdr",
    } as unknown as ReturnType<typeof TransactionBuilder.fromXDR>)

    manageBuyOfferSpy = jest.spyOn(Operation, "manageBuyOffer")
    manageSellOfferSpy = jest.spyOn(Operation, "manageSellOffer")
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  const expectResult = (
    result: { current: ReturnType<typeof useManageOffer> },
    status = "success"
  ) => {
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.result?.status).toBe(status)
    expect(result.current.result?.hash).toBe("tx_hash")
    expect(result.current.result?.ledger).toBe(100)
  }

  it("creates a buy offer successfully", async () => {
    const { result } = renderHook(() => useManageOffer())

    await act(async () => {
      await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "100",
        price: "2",
        side: "buy",
      })
    })

    expect(manageBuyOfferSpy).toHaveBeenCalledWith(
      expect.objectContaining({ buyAmount: "100", price: "2", offerId: "0" })
    )
    expect(mockSignTransaction).toHaveBeenCalled()
    expect(mockSubmitTransaction).toHaveBeenCalled()
    expectResult(result)
  })

  it("creates a sell offer successfully", async () => {
    const { result } = renderHook(() => useManageOffer())

    await act(async () => {
      await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "50",
        price: { n: 1, d: 2 },
        side: "sell",
      })
    })

    expect(manageSellOfferSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "50", offerId: "0" })
    )
    expectResult(result)
  })

  it("updates an existing offer with a valid offerId", async () => {
    const { result } = renderHook(() => useManageOffer())

    await act(async () => {
      await result.current.updateOffer("123", {
        selling: XLM,
        buying: USDC,
        amount: "25",
        price: "3",
        side: "buy",
      })
    })

    expect(manageBuyOfferSpy).toHaveBeenCalledWith(expect.objectContaining({ offerId: "123" }))
    expectResult(result)
  })

  it("rejects updateOffer without a valid offerId", async () => {
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.updateOffer("0", {
        selling: XLM,
        buying: USDC,
        amount: "25",
        price: "3",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(manageBuyOfferSpy).not.toHaveBeenCalled()
  })

  it("cancels an existing offer by looking it up and flipping it to a sell", async () => {
    mockOfferCall.mockResolvedValue({
      selling: { asset_type: "native" },
      buying: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: USDC_ISSUER },
      price_r: { n: 1, d: 2 },
    })

    const { result } = renderHook(() => useManageOffer())

    await act(async () => {
      await result.current.cancelOffer("42")
    })

    expect(mockOfferCall).toHaveBeenCalled()
    expect(manageSellOfferSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "0", offerId: "42" })
    )
    expectResult(result)
  })

  it("rejects cancelOffer without a valid offerId", async () => {
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.cancelOffer("0")
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(mockOfferCall).not.toHaveBeenCalled()
  })

  it("fails early when the wallet is not connected", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: { ...mockWallet, connected: false },
    })
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "100",
        price: "2",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("WALLET_NOT_CONNECTED")
    expect(manageSellOfferSpy).not.toHaveBeenCalled()
  })

  it("fails early in cancelOffer when the wallet is not connected", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: { ...mockWallet, connected: false },
    })
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.cancelOffer("42")
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("WALLET_NOT_CONNECTED")
    expect(mockOfferCall).not.toHaveBeenCalled()
  })

  it("rejects an offer whose selling and buying assets are the same issued asset", async () => {
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: USDC,
        buying: USDC,
        amount: "100",
        price: "2",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/must be different/)
  })

  it("rejects an offer whose selling and buying assets are both native", async () => {
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: XLM,
        buying: XLM,
        amount: "100",
        price: "2",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  })

  it("rejects a non-positive amount", async () => {
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "0",
        price: "2",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  })

  it("rejects a non-positive price", async () => {
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "100",
        price: { n: 0, d: 2 },
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  })

  it("maps an op_low_reserve submission rejection to LOW_RESERVE", async () => {
    mockSubmitTransaction.mockRejectedValue({
      response: {
        data: {
          extras: {
            result_codes: { operations: ["op_low_reserve"] },
          },
        },
      },
    })
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "100",
        price: "2",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("LOW_RESERVE")
  })

  it("maps a network failure during submission to NETWORK_ERROR", async () => {
    mockSubmitTransaction.mockRejectedValue(new Error("Network Error"))
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.createOffer({
        selling: XLM,
        buying: USDC,
        amount: "100",
        price: "2",
      })
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
  })

  it("surfaces an error when the offer lookup fails during cancellation", async () => {
    mockOfferCall.mockRejectedValue(new Error("Network Error"))
    const { result } = renderHook(() => useManageOffer())

    let res
    await act(async () => {
      res = await result.current.cancelOffer("42")
    })

    expect(res).toBeNull()
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
  })

  it("reset clears error, result and loading state", async () => {
    mockSubmitTransaction.mockRejectedValue(new Error("Network Error"))
    const { result } = renderHook(() => useManageOffer())

    await act(async () => {
      await result.current.createOffer({ selling: XLM, buying: USDC, amount: "100", price: "2" })
    })
    expect(result.current.error?.code).toBe("NETWORK_ERROR")

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
