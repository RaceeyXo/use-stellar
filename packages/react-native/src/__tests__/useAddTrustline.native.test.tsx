import {
  mockAccountData,
  mockHorizonServer,
  mockSubmitResponse,
  TESTNET_ADDRESS_A,
  TESTNET_ADDRESS_B,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk"
import { useAddTrustline, useBalance, useWallet } from "../index"
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

// Testnet-only: the issuer is a throwaway testnet account.
const USDC = { code: "USDC", issuer: TESTNET_ADDRESS_B }
const TRUSTLINE = { asset: USDC } as const

describe("useAddTrustline on React Native", () => {
  let wc: MockWalletConnectAdapterHandle

  beforeEach(() => {
    mockHorizonServer.reset()
    mockHorizonServer.loadAccount.mockResolvedValue(mockAccountData)
    wc = registerMockWalletConnectAdapter()
  })

  function renderConnected() {
    return renderHookWithStellar(() => ({
      wallet: useWallet(),
      trustline: useAddTrustline(),
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

      const { trustline } = rendered.result.current
      expect(trustline.loading).toBe(false)
      expect(trustline.error).toBeNull()
      expect(trustline.result).toBeNull()
      expect(typeof trustline.addTrustline).toBe("function")
      expect(typeof trustline.reset).toBe("function")
      expect(isWalletConnectConnected()).toBe(true)
      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("signs a changeTrust through the WalletConnect mock and submits once", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      let outcome:
        Awaited<ReturnType<typeof rendered.result.current.trustline.addTrustline>> | undefined
      await act(async () => {
        outcome = await rendered.result.current.trustline.addTrustline({
          asset: USDC,
          limit: "500",
        })
      })

      expect(outcome).toEqual({ hash: mockSubmitResponse.hash, status: "success" })
      expect(rendered.result.current.trustline.result).toEqual(outcome)
      expect(rendered.result.current.trustline.error).toBeNull()
      expect(wc.signedXdrs).toHaveLength(1)
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)

      const tx = TransactionBuilder.fromXDR(wc.signedXdrs[0], Networks.TESTNET)
      expect(tx.operations).toHaveLength(1)
      expect(tx.operations[0]).toMatchObject({
        type: "changeTrust",
        limit: "500.0000000",
      })
      rendered.unmount()
    })

    it("uses NATIVE_TRANSACTION_TIMEOUT for the transaction time bounds", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await rendered.result.current.trustline.addTrustline(TRUSTLINE)
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
      const loadsBeforeAdd = mockHorizonServer.loadAccount.mock.calls.length

      await act(async () => {
        await rendered.result.current.trustline.addTrustline(TRUSTLINE)
      })
      // A successful trustline only marks the account stale; the hook itself
      // loads the source account once.
      const loadsAfterAdd = mockHorizonServer.loadAccount.mock.calls.length
      expect(loadsAfterAdd).toBe(loadsBeforeAdd + 1)

      act(() => {
        setAppState("background")
      })
      expect(getAppState()).toBe("background")
      act(() => {
        setAppState("active")
      })

      await waitFor(() => {
        expect(mockHorizonServer.loadAccount.mock.calls.length).toBeGreaterThan(loadsAfterAdd)
      })
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      expect(wc.signedXdrs).toHaveLength(1)
      expect(rendered.result.current.trustline.result?.status).toBe("success")
      rendered.unmount()
    })

    it("survives the app going to the background while the wallet app is signing", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const hold = wc.holdNextSignature()

      let adding!: Promise<unknown>
      await act(async () => {
        adding = rendered.result.current.trustline.addTrustline(TRUSTLINE)
        await Promise.resolve()
      })
      await waitFor(() => {
        expect(wc.signedXdrs).toHaveLength(1)
        expect(rendered.result.current.trustline.loading).toBe(true)
      })

      // The user switches to the wallet app: this app goes to the background.
      act(() => {
        setAppState("background")
      })
      expect(rendered.result.current.trustline.loading).toBe(true)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()

      // The wallet approves and the user returns.
      await act(async () => {
        hold.release()
        setAppState("active")
        await adding
      })

      expect(rendered.result.current.trustline.loading).toBe(false)
      expect(rendered.result.current.trustline.error).toBeNull()
      expect(rendered.result.current.trustline.result?.status).toBe("success")
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })

    it("reports a rejection made in the wallet app after a background round trip", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      const hold = wc.holdNextSignature()

      let adding!: Promise<unknown>
      await act(async () => {
        adding = rendered.result.current.trustline.addTrustline(TRUSTLINE).catch(error => error)
        await Promise.resolve()
      })
      await waitFor(() => expect(wc.signedXdrs).toHaveLength(1))

      act(() => {
        setAppState("background")
      })
      await act(async () => {
        hold.release(new Error("User declined the request"))
        setAppState("active")
        await adding
      })

      expect(rendered.result.current.trustline.loading).toBe(false)
      expect(rendered.result.current.trustline.error?.code).toBe("WALLET_REQUEST_REJECTED")
      expect(rendered.result.current.trustline.result).toBeNull()
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

      await expect(rendered.result.current.trustline.addTrustline(TRUSTLINE)).rejects.toMatchObject(
        { code: "NETWORK_ERROR" }
      )

      expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(loadsBefore)
      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("adds the trustline once the device is back online", async () => {
      const rendered = renderConnected()
      await connect(rendered)
      act(() => {
        setOnline(false)
      })
      await expect(rendered.result.current.trustline.addTrustline(TRUSTLINE)).rejects.toMatchObject(
        { code: "NETWORK_ERROR" }
      )

      act(() => {
        setOnline(true)
      })
      await act(async () => {
        await rendered.result.current.trustline.addTrustline(TRUSTLINE)
      })

      expect(rendered.result.current.trustline.result?.status).toBe("success")
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledTimes(1)
      rendered.unmount()
    })
  })

  describe("error codes", () => {
    it("throws WALLET_NOT_CONNECTED before any network work when no wallet is connected", async () => {
      const rendered = renderConnected()
      await waitFor(() => expect(rendered.result.current.balance.loading).toBe(false))
      const loadsBefore = mockHorizonServer.loadAccount.mock.calls.length

      await expect(rendered.result.current.trustline.addTrustline(TRUSTLINE)).rejects.toMatchObject(
        { code: "WALLET_NOT_CONNECTED" }
      )

      expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(loadsBefore)
      expect(wc.signedXdrs).toHaveLength(0)
      rendered.unmount()
    })

    it("rejects XLM with VALIDATION_ERROR before signing", async () => {
      const rendered = renderConnected()
      await connect(rendered)

      await expect(
        rendered.result.current.trustline.addTrustline({
          asset: "XLM",
        } as unknown as Parameters<typeof rendered.result.current.trustline.addTrustline>[0])
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

      expect(wc.signedXdrs).toHaveLength(0)
      expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
      rendered.unmount()
    })

    it("maps an unsuccessful submission to its error code and records the failed result", async () => {
      mockHorizonServer.submitTransaction.mockResolvedValue({
        ...mockSubmitResponse,
        successful: false,
        extras: { result_codes: { transaction: "tx_failed", operations: ["op_low_reserve"] } },
      })
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(
          rendered.result.current.trustline.addTrustline(TRUSTLINE)
        ).rejects.toMatchObject({ code: "LOW_RESERVE" })
      })

      expect(rendered.result.current.trustline.error?.code).toBe("LOW_RESERVE")
      expect(rendered.result.current.trustline.result).toEqual({
        hash: mockSubmitResponse.hash,
        status: "failed",
      })
      expect(rendered.result.current.trustline.loading).toBe(false)
      rendered.unmount()
    })

    it("keeps the pre-computed hash as a pending result on a Horizon 504", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue({
        response: { status: 504, data: {} },
      })
      const rendered = renderConnected()
      await connect(rendered)

      let thrown: unknown
      await act(async () => {
        thrown = await rendered.result.current.trustline
          .addTrustline(TRUSTLINE)
          .catch((error: unknown) => error)
      })

      const signed = TransactionBuilder.fromXDR(wc.signedXdrs[0], Networks.TESTNET)
      const hash = signed.hash().toString("hex")
      expect(thrown).toMatchObject({ code: "TX_TIMEOUT", hash })
      expect(rendered.result.current.trustline.error?.code).toBe("TX_TIMEOUT")
      expect(rendered.result.current.trustline.result).toEqual({ hash, status: "pending" })
      rendered.unmount()
    })

    it("maps a transport failure during submission to NETWORK_ERROR and reset() clears it", async () => {
      mockHorizonServer.submitTransaction.mockRejectedValue(new Error("Network Error"))
      const rendered = renderConnected()
      await connect(rendered)

      await act(async () => {
        await expect(
          rendered.result.current.trustline.addTrustline(TRUSTLINE)
        ).rejects.toMatchObject({ code: "NETWORK_ERROR" })
      })
      expect(rendered.result.current.trustline.error?.code).toBe("NETWORK_ERROR")

      act(() => {
        rendered.result.current.trustline.reset()
      })
      expect(rendered.result.current.trustline.error).toBeNull()
      expect(rendered.result.current.trustline.result).toBeNull()
      rendered.unmount()
    })
  })
})
