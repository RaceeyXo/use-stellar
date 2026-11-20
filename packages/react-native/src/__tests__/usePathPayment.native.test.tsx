import {
  mockAccountData,
  mockHorizonServer,
  mockSubmitResponse,
  TESTNET_ADDRESS_A,
  TESTNET_ADDRESS_B,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk"
import { useBalance, usePathPayment, useWallet, type PathPaymentOptions } from "../index"
import { NATIVE_TRANSACTION_TIMEOUT } from "../StellarProvider"
import {
  act,
  getAppState,
  isWalletConnectConnected,
  registerMockWalletConnectAdapter,
  renderHookWithStellar,
  setAppState,
  setOnline,
  waitFor,
  type MockWalletConnectAdapterHandle,
} from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// Testnet-only: the destination and issuer are throwaway testnet accounts.
const USDC = { code: "USDC", issuer: TESTNET_ADDRESS_B }
const STRICT_SEND: PathPaymentOptions = {
  mode: "strictSend",
  destination: TESTNET_ADDRESS_B,
  sendAsset: "XLM",
  sendAmount: "100",
  destAsset: USDC,
  destMin: "24.7500000",
  path: [],
}

describe("usePathPayment on React Native", () => {
  let wc: MockWalletConnectAdapterHandle

  beforeEach(() => {
    mockHorizonServer.reset()
    mockHorizonServer.loadAccount.mockResolvedValue(mockAccountData)
    wc = registerMockWalletConnectAdapter()
  })

  function renderConnected() {
    return renderHookWithStellar(() => ({
      wallet: useWallet(),
      swap: usePathPayment(),
      balance: useBalance({ address: TESTNET_ADDRESS_A, asset: "XLM", watch: true }),
    }))
  }

  async function connect(rendered: ReturnType<typeof renderConnected>) {
    await act(async () => {
      await rendered.result.current.wallet.connect("walletconnect")
    })
    await waitFor(() => {
      expect(rendered.result.current.wallet.connected).toBe(true)
      expect(rendered.result.current.balance.loading).toBe(false)
    })
  }

  describe("initial load", () => {
    it("starts idle on a connected native wallet, with no DOM globals and no network", async () => {
      assertNoDomGlobals()
      const rendered = renderConnected()
      await connect(rendered)

      const { swap } = rendered.result.current
      expect(swap.loading).toBe(false)
      expect(swap.error).toBeNull()
      expect(swap.result).toBeNull()
      expect(typeof swap.pathPayment).toBe("function")
      expect(typeof swap.reset).toBe("function")
      expect(isWalletConnectConnected()).toBe(true)
      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("signs a strictSend path payment through the WalletConnect mock and submits once", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      let outcome: Awaited<ReturnType<typeof rendered.result.current.swap.pathPayment>> | undefined
      await act(async () => {
        outcome = await rendered.result.current.swap.pathPayment(STRICT_SEND)
      })

      expect(outcome).toMatchObject({ hash: mockSubmitResponse.hash, status: "success" })
      expect(rendered.result.current.swap.result).toEqual(outcome)
      expect(rendered.result.current.swap.error).toBeNull()
      expect(wc.signedXdrs).toHaveLength(1)
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)

      const tx = TransactionBuilder.fromXDR(wc.signedXdrs[0], Networks.TESTNET)
      expect(tx.operations[0]).toMatchObject({
        type: "pathPaymentStrictSend",
        sendAmount: "100.0000000",
        destMin: "24.7500000",
      })
      rendered.unmount()
    })

    it("signs a strictReceive path payment through the WalletConnect mock", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await rendered.result.current.swap.pathPayment({
          mode: "strictReceive",
          destination: TESTNET_ADDRESS_B,
          sendAsset: "XLM",
          sendMax: "110",
          destAsset: USDC,
          destAmount: "25",
          path: [],
        })
      })

      expect(rendered.result.current.swap.result?.status).toBe("success")
      const tx = TransactionBuilder.fromXDR(wc.signedXdrs[0], Networks.TESTNET)
      expect(tx.operations[0]).toMatchObject({
        type: "pathPaymentStrictReceive",
        sendMax: "110.0000000",
        destAmount: "25.0000000",
      })
      rendered.unmount()
    })

    it("uses NATIVE_TRANSACTION_TIMEOUT for the transaction time bounds", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await rendered.result.current.swap.pathPayment(STRICT_SEND)
      })

      expect(NATIVE_TRANSACTION_TIMEOUT).toBe(300)
      const tx = TransactionBuilder.fromXDR(wc.signedXdrs[0], Networks.TESTNET)
      const { minTime, maxTime } = tx.timeBounds!
      expect(minTime).toBe("0")
      const now = Math.floor(Date.now() / 1000)
      expect(Number(maxTime) - now).toBeGreaterThanOrEqual(NATIVE_TRANSACTION_TIMEOUT - 2)
      expect(Number(maxTime) - now).toBeLessThanOrEqual(NATIVE_TRANSACTION_TIMEOUT)
      rendered.unmount()
    })
  })

  describe("foreground", () => {
    it("refetches the stale balance on foreground return without resubmitting", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const loadsBeforeSwap = mockHorizonServer.loadAccount.mock.calls.length

      await act(async () => {
        await rendered.result.current.swap.pathPayment(STRICT_SEND)
      })
      // A successful swap only marks the account stale; the hook itself loads
      // the source account once.
      const loadsAfterSwap = mockHorizonServer.loadAccount.mock.calls.length
      expect(loadsAfterSwap).toBe(loadsBeforeSwap + 1)

      act(() => {
        setAppState("background")
      })
      expect(getAppState()).toBe("background")
      act(() => {
        setAppState("active")
      })

      await waitFor(() => {
        expect(mockHorizonServer.loadAccount.mock.calls.length).toBeGreaterThan(loadsAfterSwap)
      })
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      expect(wc.signedXdrs).toHaveLength(1)
      expect(rendered.result.current.swap.result?.status).toBe("success")
      rendered.unmount()
    })

    it("survives the app going to the background while the wallet app is signing", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const hold = wc.holdNextSignature()

      let swapping!: Promise<unknown>
      await act(async () => {
        swapping = rendered.result.current.swap.pathPayment(STRICT_SEND)
        await Promise.resolve()
      })
      await waitFor(() => {
        expect(wc.signedXdrs).toHaveLength(1)
        expect(rendered.result.current.swap.loading).toBe(true)
      })

      // The user switches to the wallet app: this app goes to the background.
      act(() => {
        setAppState("background")
      })
      expect(rendered.result.current.swap.loading).toBe(true)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()

      // The wallet approves and the user returns.
      await act(async () => {
        hold.release()
        setAppState("active")
        await swapping
      })

      expect(rendered.result.current.swap.loading).toBe(false)
      expect(rendered.result.current.swap.error).toBeNull()
      expect(rendered.result.current.swap.result?.status).toBe("success")
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })

    it("reports a rejection made in the wallet app after a background round trip", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const hold = wc.holdNextSignature()

      let swapping!: Promise<unknown>
      await act(async () => {
        swapping = rendered.result.current.swap.pathPayment(STRICT_SEND).catch(error => error)
        await Promise.resolve()
      })
      await waitFor(() => expect(wc.signedXdrs).toHaveLength(1))

      act(() => {
        setAppState("background")
      })
      await act(async () => {
        hold.release(new Error("User declined the request"))
        setAppState("active")
        await swapping
      })

      expect(rendered.result.current.swap.loading).toBe(false)
      expect(rendered.result.current.swap.error?.code).toBe("WALLET_REQUEST_REJECTED")
      expect(rendered.result.current.swap.result).toBeNull()
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })
  })

  describe("offline", () => {
    it("fails fast while offline without loading, signing or submitting", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      act(() => {
        setOnline(false)
      })
      const loadsBefore = mockHorizonServer.loadAccount.mock.calls.length

      await expect(rendered.result.current.swap.pathPayment(STRICT_SEND)).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      })

      expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(loadsBefore)
      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("swaps once the device is back online", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      act(() => {
        setOnline(false)
      })
      await expect(rendered.result.current.swap.pathPayment(STRICT_SEND)).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      })

      act(() => {
        setOnline(true)
      })
      await act(async () => {
        await rendered.result.current.swap.pathPayment(STRICT_SEND)
      })

      expect(rendered.result.current.swap.result?.status).toBe("success")
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })
  })

  describe("error codes", () => {
    it("throws WALLET_NOT_CONNECTED before any network work when no wallet is connected", async () => {
      const rendered = renderConnected()
      await waitFor(() => expect(rendered.result.current.balance.loading).toBe(false))
      const loadsBefore = mockHorizonServer.loadAccount.mock.calls.length

      await expect(rendered.result.current.swap.pathPayment(STRICT_SEND)).rejects.toMatchObject({
        code: "WALLET_NOT_CONNECTED",
      })

      expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(loadsBefore)
      expect(wc.signedXdrs).toHaveLength(0)
      rendered.unmount()
    })

    it("requires the slippage bound and fails with VALIDATION_ERROR before signing", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      await expect(
        rendered.result.current.swap.pathPayment({
          ...STRICT_SEND,
          destMin: "",
        })
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("turns a slippage rejection into a re-quote message with TRANSACTION_FAILED", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue({
        response: {
          status: 400,
          data: { extras: { result_codes: { operations: ["op_under_dest_min"] } } },
        },
      })
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(rendered.result.current.swap.pathPayment(STRICT_SEND)).rejects.toMatchObject({
          code: "TRANSACTION_FAILED",
        })
      })

      expect(rendered.result.current.swap.error?.message).toContain("op_under_dest_min")
      expect(rendered.result.current.swap.error?.message).toContain("destMin")
      expect(rendered.result.current.swap.result).toBeNull()
      expect(rendered.result.current.swap.loading).toBe(false)
      rendered.unmount()
    })

    it("records an unsuccessful Horizon result as failed", async () => {
      mockHorizonServer.submitTransaction.mockResolvedValue({
        ...mockSubmitResponse,
        successful: false,
      })
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await rendered.result.current.swap.pathPayment(STRICT_SEND)
      })

      expect(rendered.result.current.swap.result?.status).toBe("failed")
      expect(rendered.result.current.swap.error).toBeNull()
      rendered.unmount()
    })

    it("maps a Horizon 504 to TX_TIMEOUT", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue({
        response: { status: 504, data: {} },
      })
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(rendered.result.current.swap.pathPayment(STRICT_SEND)).rejects.toMatchObject({
          code: "TX_TIMEOUT",
        })
      })

      expect(rendered.result.current.swap.error?.code).toBe("TX_TIMEOUT")
      rendered.unmount()
    })

    it("maps a transport failure during submission to NETWORK_ERROR and reset() clears it", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue(new Error("Network Error"))
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(rendered.result.current.swap.pathPayment(STRICT_SEND)).rejects.toMatchObject({
          code: "NETWORK_ERROR",
        })
      })
      expect(rendered.result.current.swap.error?.code).toBe("NETWORK_ERROR")

      act(() => {
        rendered.result.current.swap.reset()
      })
      expect(rendered.result.current.swap.error).toBeNull()
      expect(rendered.result.current.swap.result).toBeNull()
      rendered.unmount()
    })
  })
})
