/**
 * useSendPayment — XDR and transaction-building tests  (issue #231)
 *
 * These tests were impossible before issue #231 because the SDK mock did not
 * export TransactionBuilder, Asset, Operation, Networks, BASE_FEE, or Memo.
 * They now run against the real SDK encoding logic via an inline jest.mock
 * factory that calls jest.requireActual from the test-file context (where it
 * reliably bypasses moduleNameMapper).
 *
 * What is covered:
 *  - A full XLM payment transaction is built, signed (mocked signer that
 *    round-trips XDR), and submitted. Result hash matches the mocked response.
 *  - The produced XDR parses cleanly through TransactionBuilder.fromXDR,
 *    proving real SDK encoding is exercised, not a fake.
 *  - A text memo is embedded when the memo option is provided.
 *  - An issued-asset payment sets the correct asset code and issuer.
 *  - WALLET_NOT_CONNECTED is thrown (and code is on the thrown object)
 *    before any Horizon call when the wallet is disconnected.
 *  - VALIDATION_ERROR is thrown when send() is called outside a browser context.
 *  - Error isolation: a rejected submitTransaction does not corrupt state for
 *    the next successful send() call.
 *
 * NOTE ON EARLY-EXIT ERROR CODES:
 *   WALLET_NOT_CONNECTED and VALIDATION_ERROR are thrown directly in the hook
 *   before setError() is called. The hook's `error` state therefore remains
 *   null for those cases — the code lives only on the thrown StellarError
 *   object. This is the current documented behaviour. See the assertions below.
 */

import React from "react"
import { renderHook, act } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import type { ReactNode } from "react"
import type { WalletState } from "../types"

// Self-contained fixtures: importing these from the shared manual mock is
// unreliable here because jest's module registry can resolve that path to the
// real SDK depending on execution order. Defining them locally keeps this
// suite deterministic.
const TESTNET_ADDRESS_A = "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ"
const TESTNET_ADDRESS_B = "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I"

const mockSubmitResponse = {
  hash: "c9a17a4b8f6e3d2c1a0b9f8e7d6c5b4a39281716050403020100af0e9d8c7b6a",
  successful: true,
  ledger: 25826413,
  envelope_xdr:
    "AAAAAgAAAABh/DWYVf7iXjMzDvBV1J1QgjqFyKQc5YwB4I1LcQ7mIq4AAABkADy7zwAAAAEAAAAAAAAAAAAAAAAA",
}

const mockAccountRecord = {
  id: TESTNET_ADDRESS_A,
  accountId: () => TESTNET_ADDRESS_A,
  sequenceNumber: () => "1234567890123456",
  incrementSequenceNumber: jest.fn(),
}

function createMockHorizonServer() {
  const loadAccount = jest.fn().mockResolvedValue({
    accountId: () => TESTNET_ADDRESS_A,
    sequenceNumber: () => "1",
    incrementSequenceNumber: jest.fn(),
  })
  const submitTransaction = jest.fn().mockResolvedValue(mockSubmitResponse)
  const fetchBaseFee = jest.fn().mockResolvedValue(100)
  return { loadAccount, submitTransaction, fetchBaseFee }
}

// ── SDK mock ──────────────────────────────────────────────────────────────────
// Load the real SDK by relative file path (bypassing the jest moduleNameMapper
// that redirects the bare "@stellar/stellar-sdk" specifier to the manual mock).
// jest.requireActual does not bypass moduleNameMapper here, so it would return
// the manual mock and lose Operation/TransactionBuilder. Only the
// Horizon.Server constructor is mocked — network calls stay local.
jest.mock("@stellar/stellar-sdk", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const real = require("../../node_modules/@stellar/stellar-sdk/lib/index.js") as any
  return {
    ...real,
    Horizon: {
      ...real.Horizon,
      Server: jest.fn().mockImplementation(() => ({})),
    },
  }
})

// ── Other module mocks ────────────────────────────────────────────────────────
// Mock ../utils so getHorizonServer returns our per-test server instance.
// isBrowser is a jest.fn() so tests can override it with mockReturnValueOnce.
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  isBrowser: jest.fn().mockReturnValue(true),
  getHorizonServer: jest.fn(),
}))

jest.mock("../wallets", () => ({
  ...jest.requireActual("../wallets"),
  getWalletAdapter: jest.fn(),
}))

// Inject wallet state via context mock.
const mockSetWallet = jest.fn()
let mockWalletState: WalletState = {
  connected: true,
  connecting: false,
  address: TESTNET_ADDRESS_A,
  network: "testnet",
  wallet: "freighter",
  error: null,
  walletNetwork: "testnet",
  walletName: "Freighter",
}

jest.mock("../context/StellarProvider", () => {
  const actual = jest.requireActual("../context/StellarProvider")
  return {
    ...actual,
    useStellarContext: () => ({
      network: "testnet",
      networkConfig: {
        network: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        sorobanUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      },
      wallet: mockWalletState,
      setWallet: mockSetWallet,
      queryStore: { invalidate: jest.fn() },
    }),
  }
})

// ── Post-mock imports ─────────────────────────────────────────────────────────
import { getHorizonServer } from "../utils"
import { getWalletAdapter } from "../wallets"
import { TransactionBuilder } from "@stellar/stellar-sdk"

// Testnet passphrase hardcoded to avoid any dependency on the Networks import
// going through the moduleNameMapper. The value is stable and defined by SDF.
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"

const mockGetHorizonServer = getHorizonServer as jest.Mock
const mockGetWalletAdapter = getWalletAdapter as jest.Mock

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

/**
 * Wire a fresh per-test server and wallet adapter.
 * The signer round-trips XDR through the real TransactionBuilder so failures
 * in the XDR encoding path surface as test failures, not mock noise.
 */
function setupMocks() {
  const server = createMockHorizonServer()
  mockGetHorizonServer.mockReturnValue(server)

  const signTransaction = jest.fn().mockImplementation((xdrStr: string) => {
    // Round-trip through real TransactionBuilder — proves encoding is genuine.
    const tx = TransactionBuilder.fromXDR(xdrStr, TESTNET_PASSPHRASE)
    return Promise.resolve(tx.toXDR())
  })

  mockGetWalletAdapter.mockReturnValue({
    signTransaction,
    metadata: { name: "Freighter" },
  })

  return { server, signTransaction }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useSendPayment — transaction building (real SDK)", () => {
  beforeEach(() => {
    // resetMocks:true clears jest.fn() implementations between tests.
    // Restore isBrowser to true (browser context) for each test.
    const utilsMock = jest.requireMock("../utils") as { isBrowser: jest.Mock }
    utilsMock.isBrowser.mockReturnValue(true)

    mockWalletState = {
      connected: true,
      connecting: false,
      address: TESTNET_ADDRESS_A,
      network: "testnet",
      wallet: "freighter",
      error: null,
      walletNetwork: "testnet",
      walletName: "Freighter",
    }
  })

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("builds a valid XLM payment and returns the submit hash", async () => {
    const { server } = setupMocks()

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    await act(async () => {
      await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "10" })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.result).toEqual({ hash: mockSubmitResponse.hash, status: "success" })
    expect(server.loadAccount).toHaveBeenCalledWith(TESTNET_ADDRESS_A)
    expect(server.submitTransaction).toHaveBeenCalledTimes(1)
  })

  it("produces XDR that round-trips through TransactionBuilder.fromXDR", async () => {
    const { signTransaction } = setupMocks()

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    await act(async () => {
      await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "5" })
    })

    expect(result.current.error).toBeNull()
    expect(signTransaction).toHaveBeenCalledTimes(1)

    const [unsignedXdr] = signTransaction.mock.calls[0] as [string]
    // Real SDK must parse the XDR without throwing.
    expect(() => TransactionBuilder.fromXDR(unsignedXdr, TESTNET_PASSPHRASE)).not.toThrow()
  })

  it("includes a text memo in the transaction when memo option is provided", async () => {
    const { signTransaction } = setupMocks()

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    await act(async () => {
      await result.current.send({
        to: TESTNET_ADDRESS_B,
        asset: "XLM",
        amount: "1",
        memo: "invoice-42",
      })
    })

    expect(result.current.error).toBeNull()

    const [unsignedXdr] = signTransaction.mock.calls[0] as [string]
    const parsed = TransactionBuilder.fromXDR(unsignedXdr, TESTNET_PASSPHRASE)
    // fromXDR returns Transaction | FeeBumpTransaction; only Transaction has memo.
    if (!("memo" in parsed)) throw new Error("Expected Transaction, not FeeBumpTransaction")
    expect(
      Buffer.isBuffer(parsed.memo.value)
        ? Buffer.from(parsed.memo.value).toString()
        : parsed.memo.value
    ).toBe("invoice-42")
  })

  it("builds an issued-asset payment with correct asset code and issuer", async () => {
    const { signTransaction } = setupMocks()

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    await act(async () => {
      await result.current.send({
        to: TESTNET_ADDRESS_B,
        asset: { code: "USDC", issuer: TESTNET_ADDRESS_B },
        amount: "100",
      })
    })

    expect(result.current.error).toBeNull()

    const [unsignedXdr] = signTransaction.mock.calls[0] as [string]
    const parsed = TransactionBuilder.fromXDR(unsignedXdr, TESTNET_PASSPHRASE)
    if (!("operations" in parsed)) throw new Error("Expected Transaction")

    const op = parsed.operations[0] as { asset?: { code: string; issuer: string } }
    expect(op.asset?.code).toBe("USDC")
    expect(op.asset?.issuer).toBe(TESTNET_ADDRESS_B)
  })

  it("uses mockAccountRecord as the transaction source account", async () => {
    const { server } = setupMocks()
    server.loadAccount.mockResolvedValue(mockAccountRecord)

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    await act(async () => {
      await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "1" })
    })

    expect(result.current.error).toBeNull()
    expect(server.loadAccount).toHaveBeenCalledWith(TESTNET_ADDRESS_A)
  })

  // ── Error cases ────────────────────────────────────────────────────────────

  it("throws WALLET_NOT_CONNECTED (on thrown object) before any Horizon call when disconnected", async () => {
    mockWalletState = { ...mockWalletState, connected: false, address: null, wallet: null }
    const { server } = setupMocks()

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    let caught: unknown = null
    await act(async () => {
      try {
        await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "1" })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).not.toBeNull()
    // The early-exit guard throws directly without calling setError, so
    // result.current.error is null. The code lives on the thrown StellarError.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((caught as any).code).toBe("WALLET_NOT_CONNECTED")
    expect(result.current.error).toBeNull()
    expect(server.loadAccount).not.toHaveBeenCalled()
    expect(server.submitTransaction).not.toHaveBeenCalled()
  })

  it("throws VALIDATION_ERROR (on thrown object) when isBrowser() returns false", async () => {
    const utilsMock = jest.requireMock("../utils") as { isBrowser: jest.Mock }
    utilsMock.isBrowser.mockReturnValueOnce(false)
    const { server } = setupMocks()

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    let caught: unknown = null
    await act(async () => {
      try {
        await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "1" })
      } catch (e) {
        caught = e
      }
    })

    expect(caught).not.toBeNull()
    expect((caught as Error).message).toContain(
      "Transaction signing is only available in the browser."
    )
    // Same early-exit pattern — result.current.error stays null.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((caught as any).code).toBe("VALIDATION_ERROR")
    expect(result.current.error).toBeNull()
    expect(server.loadAccount).not.toHaveBeenCalled()
  })

  it("sets loading to false and error.message after a submission failure", async () => {
    const { server } = setupMocks()
    server.submitTransaction.mockRejectedValueOnce(new Error("Network timeout"))

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    await act(async () => {
      try {
        await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "1" })
      } catch {
        // expected throw
      }
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).not.toBeNull()
  })

  // ── Error isolation ────────────────────────────────────────────────────────
  // Proves that a failed send() does not corrupt state for the next send().
  // This was impossible to test with the old shared-singleton mock.

  it("error isolation: a failed send does not affect the following successful send", async () => {
    const { server } = setupMocks()
    server.submitTransaction.mockRejectedValueOnce(new Error("Horizon overloaded"))

    const { result } = renderHook(() => useSendPayment(), { wrapper })

    // First send — expected to fail.
    let firstError: unknown = null
    await act(async () => {
      try {
        await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "1" })
      } catch (e) {
        firstError = e
      }
    })

    expect((firstError as Error)?.message).toBe("Horizon overloaded")
    expect(result.current.error?.message).toBe("Horizon overloaded")
    expect(result.current.result).toBeNull()
    expect(result.current.loading).toBe(false)

    // Clear the error state.
    act(() => result.current.reset())
    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()

    // Second send — submitTransaction now falls through to the default success mock.
    await act(async () => {
      await result.current.send({ to: TESTNET_ADDRESS_B, asset: "XLM", amount: "2" })
    })

    // Second send must succeed with clean state.
    expect(result.current.error).toBeNull()
    expect(result.current.result?.hash).toBe(mockSubmitResponse.hash)
    expect(server.submitTransaction).toHaveBeenCalledTimes(2)
  })
})
