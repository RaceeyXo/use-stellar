import {
  Horizon,
  Networks,
  SorobanDataBuilder,
  SorobanRpc,
  TESTNET_ADDRESS_A,
  TransactionBuilder,
  createMockSorobanServer,
  mockAccountData,
  mockHorizonServer,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk"
import { onlineManager, registerWalletAdapter, useSorobanWrite, useWallet } from "../index"
import type { StellarError } from "../index"
import { act, renderHookWithStellar, setAppState, setOnline } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"
const WALLET_TYPE = "native-test-wallet" as never
const TX_HASH = "a".repeat(64)

/** 2^100 + 12345: far above Number.MAX_SAFE_INTEGER, and wider than 64 bits. */
const BIG_I128 = 2n ** 100n + 12345n
/** Just past Number.MAX_SAFE_INTEGER (2^53 - 1), where a Number cast first loses digits. */
const JUST_ABOVE_2_53 = 2n ** 53n + 1n

const rpcStatus = SorobanRpc.Api.GetTransactionStatus

/**
 * KNOWN BUG, tracked separately (see the PR description): `useSorobanWrite` guards
 * on `isBrowser()` (`typeof window !== "undefined"`), and React Native has no
 * `window`, so on native every `invoke()` rejects with VALIDATION_ERROR ("only
 * available in the browser") before it reaches the wallet or the network. Sibling
 * hooks (`useSendPayment`, `useAddTrustline`, `usePathPayment`) use
 * `canSignTransactions()`, which accepts React Native.
 *
 * This test PR does not patch the hook. Each case below states the behaviour a
 * working native hook must have, and is marked `it.failing` until then: it passes
 * while the hook is broken, and Jest fails it as soon as the hook is fixed, which
 * is the cue to change `itOnceFixed` to `it`. Every case was also run against a
 * local one-line patch of the guard and passed.
 */
const itOnceFixed = it.failing

let server: ReturnType<typeof createMockSorobanServer>
let signTransaction: jest.Mock
/** The network the test wallet reports about itself. */
let walletNetworkState: { network: "testnet" | "futurenet"; networkPassphrase: string }

/** `xdr` is a value in the SDK mock, so its types are reached through it. */
type ScVal = ReturnType<typeof xdr.ScVal.scvVoid>

function simulationSuccess(retval: ScVal = xdr.ScVal.scvVoid()) {
  return {
    _parsed: true,
    id: "1",
    latestLedger: 100,
    events: [],
    transactionData: new SorobanDataBuilder(),
    minResourceFee: "100",
    result: { auth: [], retval },
  }
}

function successfulTransaction(returnValue?: ScVal) {
  return { status: rpcStatus.SUCCESS, returnValue }
}

/** Mounts the hook under the native provider with a connected wallet. */
async function mountConnected() {
  const mounted = renderHookWithStellar(() => ({
    write: useSorobanWrite<unknown>(),
    wallet: useWallet(),
  }))
  await act(async () => {
    await mounted.result.current.wallet.connect(WALLET_TYPE)
  })
  expect(mounted.result.current.wallet.connected).toBe(true)
  return mounted
}

/** Reads the first contract-call argument out of a built transaction. */
function firstArgOf(tx: { toXDR(): string }, passphrase = Networks.TESTNET): bigint {
  const built = TransactionBuilder.fromXDR(tx.toXDR(), passphrase)
  const [operation] = (
    built as unknown as {
      operations: Array<{ func: { invokeContract(): { args(): ScVal[] } } }>
    }
  ).operations
  const args = operation.func.invokeContract().args()
  return scValToNative(args[0]) as bigint
}

function errorOf(promise: Promise<unknown>): Promise<StellarError> {
  return promise.then(
    () => {
      throw new Error("expected invoke() to reject")
    },
    (error: StellarError) => error
  )
}

describe("useSorobanWrite on React Native", () => {
  beforeAll(() => {
    signTransaction = jest.fn()
    registerWalletAdapter(
      {
        metadata: { type: WALLET_TYPE, name: "Native Test Wallet", supported: true },
        isAvailable: async () => true,
        connect: async network => ({
          address: TESTNET_ADDRESS_A,
          wallet: WALLET_TYPE,
          network,
          networkPassphrase: Networks.TESTNET,
        }),
        getNetworkDetails: async () => walletNetworkState,
        signTransaction: (...args: unknown[]) => signTransaction(...args),
      },
      { override: true }
    )
  })

  beforeEach(() => {
    server = createMockSorobanServer()
    ;(SorobanRpc.Server as jest.Mock).mockImplementation(() => server)
    ;(Horizon.Server as jest.Mock).mockImplementation(() => mockHorizonServer)
    mockHorizonServer.loadAccount.mockResolvedValue(mockAccountData)

    server.simulateTransaction.mockResolvedValue(simulationSuccess())
    server.sendTransaction.mockResolvedValue({ status: "PENDING", hash: TX_HASH })
    server.getTransaction.mockResolvedValue(successfulTransaction())

    // Echo the XDR back: a wallet that signs what it was handed.
    signTransaction.mockReset()
    signTransaction.mockImplementation(async (txXdr: string) => txXdr)
    walletNetworkState = { network: "testnet", networkPassphrase: Networks.TESTNET }
  })

  describe("initial load", () => {
    it("starts idle and makes no network or wallet call on mount", () => {
      assertNoDomGlobals()
      const { result, unmount } = renderHookWithStellar(() => useSorobanWrite())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.result).toBeNull()
      expect(typeof result.current.invoke).toBe("function")
      expect(typeof result.current.reset).toBe("function")
      expect(server.simulateTransaction).not.toHaveBeenCalled()
      expect(mockHorizonServer.loadAccount).not.toHaveBeenCalled()
      expect(signTransaction).not.toHaveBeenCalled()
      unmount()
    })

    itOnceFixed("runs simulate, sign, send and poll for a connected wallet", async () => {
      server.getTransaction.mockResolvedValue(successfulTransaction(xdr.ScVal.scvU32(7)))
      const { result, unmount } = await mountConnected()

      let outcome: { hash: string; result: unknown } | undefined
      await act(async () => {
        outcome = await result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      })

      expect(outcome).toEqual({ hash: TX_HASH, result: 7 })
      expect(result.current.write.result).toEqual({ hash: TX_HASH, result: 7 })
      expect(result.current.write.loading).toBe(false)
      expect(result.current.write.error).toBeNull()
      expect(server.simulateTransaction).toHaveBeenCalledTimes(1)
      expect(signTransaction).toHaveBeenCalledTimes(1)
      expect(signTransaction.mock.calls[0][1]).toMatchObject({
        address: TESTNET_ADDRESS_A,
        networkPassphrase: Networks.TESTNET,
      })
      expect(server.sendTransaction).toHaveBeenCalledTimes(1)
      expect(server.getTransaction).toHaveBeenCalledWith(TX_HASH)
      unmount()
    })

    itOnceFixed("clears loading, error and result with reset()", async () => {
      const { result, unmount } = await mountConnected()
      await act(async () => {
        await result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      })
      expect(result.current.write.result).not.toBeNull()

      act(() => result.current.write.reset())

      expect(result.current.write.result).toBeNull()
      expect(result.current.write.error).toBeNull()
      expect(result.current.write.loading).toBe(false)
      unmount()
    })
  })

  describe("app foreground and background", () => {
    itOnceFixed("never re-sends a transaction when the app returns to the foreground", async () => {
      const { result, unmount } = await mountConnected()
      await act(async () => {
        await result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      })
      const sends = server.sendTransaction.mock.calls.length
      const signs = signTransaction.mock.calls.length

      act(() => setAppState("background"))
      act(() => setAppState("active"))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000)
      })

      // A write is an action, not a query: a foreground change must not repeat it.
      expect(server.sendTransaction).toHaveBeenCalledTimes(sends)
      expect(signTransaction).toHaveBeenCalledTimes(signs)
      expect(server.simulateTransaction).toHaveBeenCalledTimes(1)
      expect(result.current.write.result?.hash).toBe(TX_HASH)
      unmount()
    })

    itOnceFixed("can invoke again once the app is back in the foreground", async () => {
      const { result, unmount } = await mountConnected()
      act(() => setAppState("background"))
      act(() => setAppState("active"))

      await act(async () => {
        await result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      })

      expect(result.current.write.result?.hash).toBe(TX_HASH)
      expect(server.sendTransaction).toHaveBeenCalledTimes(1)
      unmount()
    })
  })

  describe("offline", () => {
    // `onlineManager` attaches the NetInfo signal only while something subscribes
    // to it, which a mounted query hook (useBalance, useAccount, ...) does in a real
    // app. A write-only tree subscribes to nothing; that case is covered separately.
    let detachSignal: () => void
    beforeEach(() => {
      detachSignal = onlineManager.subscribe(() => undefined)
    })
    afterEach(() => detachSignal())

    itOnceFixed("fails fast with NETWORK_ERROR and signs and submits nothing", async () => {
      const { result, unmount } = await mountConnected()
      act(() => setOnline(false))

      let error: StellarError | undefined
      await act(async () => {
        error = await errorOf(
          result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
        )
      })

      expect(error?.code).toBe("NETWORK_ERROR")
      expect(error?.message).toMatch(/offline/i)
      expect(result.current.write.error?.code).toBe("NETWORK_ERROR")
      expect(mockHorizonServer.loadAccount).not.toHaveBeenCalled()
      expect(server.simulateTransaction).not.toHaveBeenCalled()
      expect(signTransaction).not.toHaveBeenCalled()
      expect(server.sendTransaction).not.toHaveBeenCalled()
      unmount()
    })

    itOnceFixed("does not queue the write: reconnecting alone sends nothing", async () => {
      const { result, unmount } = await mountConnected()
      act(() => setOnline(false))
      let error: StellarError | undefined
      await act(async () => {
        error = await errorOf(
          result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
        )
      })
      expect(error?.code).toBe("NETWORK_ERROR")

      act(() => setOnline(true))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000)
      })

      expect(server.sendTransaction).not.toHaveBeenCalled()
      expect(signTransaction).not.toHaveBeenCalled()
      unmount()
    })

    itOnceFixed("succeeds on a retry after reconnecting", async () => {
      const { result, unmount } = await mountConnected()
      act(() => setOnline(false))
      await act(async () => {
        await errorOf(result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" }))
      })

      act(() => setOnline(true))
      await act(async () => {
        await result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      })

      expect(result.current.write.error).toBeNull()
      expect(result.current.write.result?.hash).toBe(TX_HASH)
      expect(server.sendTransaction).toHaveBeenCalledTimes(1)
      unmount()
    })
  })

  // KNOWN GAP, second part of the bug report: with no query hook mounted, nothing
  // subscribes to `onlineManager`, so the NetInfo signal is never attached and
  // `isOnline()` stays true on native (there is no `navigator.onLine` to fall back
  // on). The offline fail-fast in `invoke()` then never triggers. This stays
  // failing after the `isBrowser()` guard is fixed; it needs a core change.
  it.failing("fails fast offline even when only the write hook is mounted", async () => {
    const { result, unmount } = await mountConnected()
    act(() => setOnline(false))

    let error: StellarError | undefined
    await act(async () => {
      error = await errorOf(
        result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      )
    })

    expect(error?.code).toBe("NETWORK_ERROR")
    expect(server.sendTransaction).not.toHaveBeenCalled()
    unmount()
  })

  describe("error codes", () => {
    async function invokeExpectingError(
      options: { timeout?: number } = {},
      advanceMs = 0
    ): Promise<{ error: StellarError; hook: Awaited<ReturnType<typeof mountConnected>> }> {
      const hook = await mountConnected()
      let error: StellarError | undefined
      await act(async () => {
        const pending = errorOf(
          hook.result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump", ...options })
        )
        if (advanceMs) await jest.advanceTimersByTimeAsync(advanceMs)
        error = await pending
      })
      return { error: error as StellarError, hook }
    }

    itOnceFixed("reports WALLET_NOT_CONNECTED before any network call", async () => {
      const { result, unmount } = renderHookWithStellar(() => useSorobanWrite())

      let error: StellarError | undefined
      await act(async () => {
        error = await errorOf(result.current.invoke({ contractId: CONTRACT_ID, method: "bump" }))
      })

      expect(error?.code).toBe("WALLET_NOT_CONNECTED")
      expect(result.current.error?.code).toBe("WALLET_NOT_CONNECTED")
      expect(mockHorizonServer.loadAccount).not.toHaveBeenCalled()
      unmount()
    })

    itOnceFixed("reports WRONG_NETWORK when the wallet is on another network", async () => {
      walletNetworkState = { network: "futurenet", networkPassphrase: Networks.FUTURENET }

      const { error, hook } = await invokeExpectingError()

      expect(error.code).toBe("WRONG_NETWORK")
      expect(server.simulateTransaction).not.toHaveBeenCalled()
      expect(signTransaction).not.toHaveBeenCalled()
      hook.unmount()
    })

    itOnceFixed("reports SIMULATION_FAILED and signs nothing", async () => {
      server.simulateTransaction.mockResolvedValue({ error: "HostError: contract trapped" })

      const { error, hook } = await invokeExpectingError()

      expect(error.code).toBe("SIMULATION_FAILED")
      expect(error.message).toContain("contract trapped")
      expect(signTransaction).not.toHaveBeenCalled()
      expect(server.sendTransaction).not.toHaveBeenCalled()
      hook.unmount()
    })

    itOnceFixed("reports RESTORE_PREAMBLE_REQUIRED for archived state", async () => {
      server.simulateTransaction.mockResolvedValue({
        ...simulationSuccess(),
        restorePreamble: {
          minResourceFee: "100",
          transactionData: new SorobanDataBuilder(),
        },
      })

      const { error, hook } = await invokeExpectingError()

      expect(error.code).toBe("RESTORE_PREAMBLE_REQUIRED")
      expect(signTransaction).not.toHaveBeenCalled()
      hook.unmount()
    })

    itOnceFixed("reports TRANSACTION_FAILED when submission is rejected", async () => {
      server.sendTransaction.mockResolvedValue({
        status: "ERROR",
        hash: TX_HASH,
        errorResult: { result: () => ({ switch: () => ({ name: "txBadSeq" }) }) },
      })

      const { error, hook } = await invokeExpectingError()

      expect(error.code).toBe("TRANSACTION_FAILED")
      expect(error.message).toContain("txBadSeq")
      expect(error.hash).toBe(TX_HASH)
      hook.unmount()
    })

    itOnceFixed("reports TRANSACTION_FAILED when the transaction fails on-chain", async () => {
      server.getTransaction.mockResolvedValue({ status: rpcStatus.FAILED, resultXdr: "AAAA" })

      const { error, hook } = await invokeExpectingError()

      expect(error.code).toBe("TRANSACTION_FAILED")
      expect(error.hash).toBe(TX_HASH)
      hook.unmount()
    })

    itOnceFixed(
      "reports TX_TIMEOUT with the hash while the transaction is still unknown",
      async () => {
        server.getTransaction.mockResolvedValue({ status: rpcStatus.NOT_FOUND })

        const { error, hook } = await invokeExpectingError({ timeout: 1_000 }, 5_000)

        expect(error.code).toBe("TX_TIMEOUT")
        expect(error.hash).toBe(TX_HASH)
        hook.unmount()
      }
    )

    itOnceFixed("surfaces a wallet rejection and leaves the transaction unsent", async () => {
      signTransaction.mockRejectedValue(new Error("User declined access"))

      const { error, hook } = await invokeExpectingError()

      expect(error.code).toBe("WALLET_REQUEST_REJECTED")
      expect(server.sendTransaction).not.toHaveBeenCalled()
      expect(hook.result.current.write.loading).toBe(false)
      hook.unmount()
    })

    itOnceFixed("clears a previous error when the next invoke succeeds", async () => {
      server.simulateTransaction.mockResolvedValueOnce({ error: "HostError: trapped" })
      const { error, hook } = await invokeExpectingError()
      expect(error.code).toBe("SIMULATION_FAILED")

      await act(async () => {
        await hook.result.current.write.invoke({ contractId: CONTRACT_ID, method: "bump" })
      })

      expect(hook.result.current.write.error).toBeNull()
      expect(hook.result.current.write.result?.hash).toBe(TX_HASH)
      hook.unmount()
    })
  })

  describe("i128 arguments under Hermes-style globals", () => {
    it("has no DOM globals, as on Hermes", () => {
      assertNoDomGlobals()
      expect(typeof BigInt).toBe("function")
    })

    itOnceFixed("keeps an i128 above 2^53 intact through simulate, sign and submit", async () => {
      server.getTransaction.mockResolvedValue(
        successfulTransaction(nativeToScVal(BIG_I128, { type: "i128" }))
      )
      const { result, unmount } = await mountConnected()

      let outcome: { hash: string; result: unknown } | undefined
      await act(async () => {
        outcome = await result.current.write.invoke({
          contractId: CONTRACT_ID,
          method: "transfer",
          args: [nativeToScVal(BIG_I128, { type: "i128" })],
        })
      })

      // Simulate: the transaction handed to the RPC carries the exact value.
      const simulated = server.simulateTransaction.mock.calls[0][0]
      expect(firstArgOf(simulated)).toBe(BIG_I128)

      // Sign: the XDR the wallet was asked to sign carries it too.
      const toSign = signTransaction.mock.calls[0][0] as string
      expect(firstArgOf({ toXDR: () => toSign })).toBe(BIG_I128)

      // Submit: and so does the transaction that was sent.
      const sent = server.sendTransaction.mock.calls[0][0]
      expect(firstArgOf(sent)).toBe(BIG_I128)

      // The decoded return value is still a bigint, not a rounded Number.
      expect(typeof outcome?.result).toBe("bigint")
      expect(outcome?.result).toBe(BIG_I128)
      expect(result.current.write.result?.result).toBe(BIG_I128)
      unmount()
    })

    itOnceFixed("does not round a value one past 2^53 to a neighbouring Number", async () => {
      expect(BigInt(Number(JUST_ABOVE_2_53))).not.toBe(JUST_ABOVE_2_53)
      server.getTransaction.mockResolvedValue(
        successfulTransaction(nativeToScVal(JUST_ABOVE_2_53, { type: "i128" }))
      )
      const { result, unmount } = await mountConnected()

      await act(async () => {
        await result.current.write.invoke({
          contractId: CONTRACT_ID,
          method: "transfer",
          args: [nativeToScVal(JUST_ABOVE_2_53, { type: "i128" })],
        })
      })

      expect(firstArgOf(server.sendTransaction.mock.calls[0][0])).toBe(JUST_ABOVE_2_53)
      expect(result.current.write.result?.result).toBe(JUST_ABOVE_2_53)
      unmount()
    })

    itOnceFixed("keeps a negative i128 below -2^53 intact", async () => {
      const negative = -BIG_I128
      server.getTransaction.mockResolvedValue(
        successfulTransaction(nativeToScVal(negative, { type: "i128" }))
      )
      const { result, unmount } = await mountConnected()

      await act(async () => {
        await result.current.write.invoke({
          contractId: CONTRACT_ID,
          method: "transfer",
          args: [nativeToScVal(negative, { type: "i128" })],
        })
      })

      expect(firstArgOf(server.sendTransaction.mock.calls[0][0])).toBe(negative)
      expect(result.current.write.result?.result).toBe(negative)
      unmount()
    })
  })
})
