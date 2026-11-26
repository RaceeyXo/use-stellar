import {
  mockAccountData,
  mockHorizonServer,
  mockSubmitResponse,
  TESTNET_ADDRESS_A,
  TESTNET_ADDRESS_B,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk"
import { useBalance, useSendPayment, useWallet } from "../index"
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

const PAYMENT = { to: TESTNET_ADDRESS_B, asset: "XLM", amount: "10" } as const

describe("useSendPayment on React Native", () => {
  let wc: MockWalletConnectAdapterHandle

  beforeEach(() => {
    mockHorizonServer.reset()
    mockHorizonServer.loadAccount.mockResolvedValue(mockAccountData)
    wc = registerMockWalletConnectAdapter()
  })

  function renderConnected() {
    return renderHookWithStellar(() => ({
      wallet: useWallet(),
      payment: useSendPayment(),
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

      const { payment } = rendered.result.current
      expect(payment.loading).toBe(false)
      expect(payment.error).toBeNull()
      expect(payment.result).toBeNull()
      expect(typeof payment.send).toBe("function")
      expect(typeof payment.reset).toBe("function")
      expect(isWalletConnectConnected()).toBe(true)
      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("signs through the WalletConnect mock and submits once", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      let outcome: Awaited<ReturnType<typeof rendered.result.current.payment.send>> | undefined
      await act(async () => {
        outcome = await rendered.result.current.payment.send(PAYMENT)
      })

      expect(outcome).toEqual({ hash: mockSubmitResponse.hash, status: "success" })
      expect(rendered.result.current.payment.result).toEqual(outcome)
      expect(rendered.result.current.payment.error).toBeNull()
      expect(wc.signedXdrs).toHaveLength(1)
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })

    it("uses NATIVE_TRANSACTION_TIMEOUT for the transaction time bounds", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await rendered.result.current.payment.send(PAYMENT)
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
      const loadsBeforeSend = mockHorizonServer.loadAccount.mock.calls.length

      await act(async () => {
        await rendered.result.current.payment.send(PAYMENT)
      })
      // A successful send only marks the sender's account stale; the send
      // itself loads the source account once.
      const loadsAfterSend = mockHorizonServer.loadAccount.mock.calls.length
      expect(loadsAfterSend).toBe(loadsBeforeSend + 1)

      act(() => {
        setAppState("background")
      })
      expect(getAppState()).toBe("background")
      act(() => {
        setAppState("active")
      })

      await waitFor(() => {
        expect(mockHorizonServer.loadAccount.mock.calls.length).toBeGreaterThan(loadsAfterSend)
      })
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      expect(wc.signedXdrs).toHaveLength(1)
      expect(rendered.result.current.payment.result?.status).toBe("success")
      rendered.unmount()
    })

    it("survives the app going to the background while the wallet app is signing", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const hold = wc.holdNextSignature()

      let sending!: Promise<unknown>
      await act(async () => {
        sending = rendered.result.current.payment.send(PAYMENT)
        await Promise.resolve()
      })
      await waitFor(() => {
        expect(wc.signedXdrs).toHaveLength(1)
        expect(rendered.result.current.payment.loading).toBe(true)
      })

      // The user switches to the wallet app: this app goes to the background.
      act(() => {
        setAppState("background")
      })
      expect(rendered.result.current.payment.loading).toBe(true)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()

      // The wallet approves and the user returns.
      await act(async () => {
        hold.release()
        setAppState("active")
        await sending
      })

      expect(rendered.result.current.payment.loading).toBe(false)
      expect(rendered.result.current.payment.error).toBeNull()
      expect(rendered.result.current.payment.result?.status).toBe("success")
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })

    it("reports a rejection made in the wallet app after a background round trip", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const hold = wc.holdNextSignature()

      let sending!: Promise<unknown>
      await act(async () => {
        sending = rendered.result.current.payment.send(PAYMENT).catch(error => error)
        await Promise.resolve()
      })
      await waitFor(() => expect(wc.signedXdrs).toHaveLength(1))

      act(() => {
        setAppState("background")
      })
      await act(async () => {
        hold.release(new Error("User declined the request"))
        setAppState("active")
        await sending
      })

      expect(rendered.result.current.payment.loading).toBe(false)
      expect(rendered.result.current.payment.error?.code).toBe("WALLET_REQUEST_REJECTED")
      expect(rendered.result.current.payment.result).toBeNull()
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

      await expect(rendered.result.current.payment.send(PAYMENT)).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      })

      expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(loadsBefore)
      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("sends again once the device is back online", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      act(() => {
        setOnline(false)
      })
      await expect(rendered.result.current.payment.send(PAYMENT)).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      })

      act(() => {
        setOnline(true)
      })
      await act(async () => {
        await rendered.result.current.payment.send(PAYMENT)
      })

      expect(rendered.result.current.payment.result?.status).toBe("success")
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })
  })

  describe("error codes", () => {
    it("throws WALLET_NOT_CONNECTED before any network work when no wallet is connected", async () => {
      const rendered = renderConnected()
      await waitFor(() => expect(rendered.result.current.balance.loading).toBe(false))
      const loadsBefore = mockHorizonServer.loadAccount.mock.calls.length

      await expect(rendered.result.current.payment.send(PAYMENT)).rejects.toMatchObject({
        code: "WALLET_NOT_CONNECTED",
      })

      expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(loadsBefore)
      expect(wc.signedXdrs).toHaveLength(0)
      rendered.unmount()
    })

    it("maps op_underfunded to INSUFFICIENT_BALANCE and records the failed result", async () => {
      mockHorizonServer.submitTransaction.mockResolvedValue({
        ...mockSubmitResponse,
        successful: false,
        extras: { result_codes: { transaction: "tx_failed", operations: ["op_underfunded"] } },
      })
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(rendered.result.current.payment.send(PAYMENT)).rejects.toMatchObject({
          code: "INSUFFICIENT_BALANCE",
        })
      })

      expect(rendered.result.current.payment.error?.code).toBe("INSUFFICIENT_BALANCE")
      expect(rendered.result.current.payment.result?.status).toBe("failed")
      expect(rendered.result.current.payment.loading).toBe(false)
      rendered.unmount()
    })

    it("keeps the pre-computed hash as a pending result on a Horizon 504", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue({
        response: { status: 504, data: {} },
      })
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(rendered.result.current.payment.send(PAYMENT)).rejects.toMatchObject({
          code: "TX_TIMEOUT",
        })
      })

      const { result, error } = rendered.result.current.payment
      expect(error?.code).toBe("TX_TIMEOUT")
      expect(result?.status).toBe("pending")
      const signed = TransactionBuilder.fromXDR(wc.signedXdrs[0], Networks.TESTNET)
      expect(result?.hash).toBe(signed.hash().toString("hex"))
      rendered.unmount()
    })

    it("maps a transport failure during submission to NETWORK_ERROR and reset() clears it", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue(new Error("Network Error"))
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(rendered.result.current.payment.send(PAYMENT)).rejects.toMatchObject({
          code: "NETWORK_ERROR",
        })
      })
      expect(rendered.result.current.payment.error?.code).toBe("NETWORK_ERROR")

      act(() => {
        rendered.result.current.payment.reset()
      })
      expect(rendered.result.current.payment.error).toBeNull()
      expect(rendered.result.current.payment.result).toBeNull()
      rendered.unmount()
    })
  })
})
