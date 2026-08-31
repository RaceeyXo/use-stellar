/**
 * useSendPayment — 504 Gateway Timeout and submission-error handling
 *
 * These tests cover the network-error paths in useSendPayment:
 *  - 504 produces TX_TIMEOUT with the pre-computed transaction hash
 *  - A genuine network error (no response) produces NETWORK_ERROR (no hash)
 *  - 502 is NETWORK_ERROR, not TX_TIMEOUT
 *  - tx_bad_seq produces SEQUENCE_MISMATCH
 *
 * The SDK mock exports the real TransactionBuilder/Asset/Operation/Memo so
 * transaction building reaches the actual XDR encoding path; only
 * Horizon.Server is replaced via getHorizonServer() so submission can be
 * driven by jest.fn().
 *
 * NOTE: jest.mock("../context/StellarProvider") is hoisted to the top so
 * useSendPayment's useStellarContext() receives the connected wallet state.
 * The old file placed this mock inside a describe block where it was NOT
 * hoisted — the mock never took effect and tests relied on the real provider
 * giving default state (wallet disconnected), which would have thrown
 * WALLET_NOT_CONNECTED before any submission path was reached.
 *
 * Jest only hoists jest.mock() calls that appear at the TOP LEVEL of the
 * module. Calls inside describe(), beforeEach(), or any other function are
 * executed in-place (after imports), so the module under test is already
 * loaded with the real implementation before the mock is registered.
 */
import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import type { WalletState } from "../types"

// ── Top-level mock declarations (hoisted by Jest) ──────────────────────────────
// Activates the manual mock at __mocks__/@stellar/stellar-sdk.ts.
// The manual mock re-exports real TransactionBuilder/Asset/Operation/Memo so
// XDR encoding is real; only Horizon.Server is a jest.fn() double.
jest.mock("@stellar/stellar-sdk")

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  isBrowser: () => true,
  getHorizonServer: jest.fn(),
}))

jest.mock("../wallets", () => ({
  getWalletAdapter: jest.fn(() => ({
    signTransaction: jest.fn((xdr: string) => Promise.resolve(xdr)),
  })),
}))

// Inject a connected wallet state so useSendPayment's guard passes.
// This must be at top scope so Jest hoists it before the module under test
// imports useStellarContext. If this mock were placed inside describe() it
// would NOT be hoisted and the real (disconnected) context would be used,
// causing WALLET_NOT_CONNECTED before any submission path is reached.
const mockWalletState: WalletState = {
  connected: true,
  address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
  network: "testnet",
  wallet: "freighter",
  connecting: false,
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
      setWallet: jest.fn(),
      queryStore: { invalidate: jest.fn() },
      autoConnect: { enabled: false, persistAddress: false, storage: "local" as const },
    }),
  }
})

// ── Post-mock imports ──────────────────────────────────────────────────────────
import { getHorizonServer } from "../utils"

const mockGetServer = getHorizonServer as jest.Mock

// ── Test wrapper ───────────────────────────────────────────────────────────────
function Wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

// ── Shared account fixture ─────────────────────────────────────────────────────
// TransactionBuilder-compatible source account: requires accountId(),
// sequenceNumber(), and incrementSequenceNumber() to build a transaction.
function makeSourceAccount() {
  return {
    sequenceNumber: () => "123",
    accountId: () => "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
    incrementSequenceNumber: jest.fn(),
  }
}

const DESTINATION = "GBBD47IF6LWK7P7MABN5KIK65Y6XVTX3CHGYVM4PBZSTSTBHX7WEEHQK"

describe("useSendPayment - 504 Gateway Timeout handling", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("HTTP 504 produces TX_TIMEOUT with transaction hash", async () => {
    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue(makeSourceAccount()),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockRejectedValue({
        response: {
          status: 504,
          data: {
            type: "https://stellar.org/horizon-errors/timeout",
            title: "Gateway Timeout",
            status: 504,
          },
        },
      }),
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null
    try {
      await result.current.send({ to: DESTINATION, asset: "XLM", amount: "10" })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("TX_TIMEOUT")
      expect((caughtError as { hash?: string })?.hash).toBeDefined()
      expect(typeof (caughtError as { hash?: string })?.hash).toBe("string")
      // Transaction hash is always 64 hex characters (32 bytes).
      expect((caughtError as { hash?: string })?.hash).toHaveLength(64)
    })
  })

  test("genuine network failure (no response) produces NETWORK_ERROR", async () => {
    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue(makeSourceAccount()),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockRejectedValue(new Error("Network request failed")),
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null
    try {
      await result.current.send({ to: DESTINATION, asset: "XLM", amount: "10" })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("NETWORK_ERROR")
      // No hash for genuine network failures — no XDR was built.
      expect((caughtError as { hash?: string })?.hash).toBeUndefined()
    })
  })

  test("502 Bad Gateway produces NETWORK_ERROR, not TX_TIMEOUT", async () => {
    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue(makeSourceAccount()),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockRejectedValue({
        response: {
          status: 502,
          data: {
            type: "https://stellar.org/horizon-errors/bad_gateway",
            title: "Bad Gateway",
            status: 502,
          },
        },
      }),
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null
    try {
      await result.current.send({ to: DESTINATION, asset: "XLM", amount: "10" })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("NETWORK_ERROR")
    })
  })

  test("transaction hash is computed before submission", async () => {
    let capturedHash: string | undefined

    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue(makeSourceAccount()),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockImplementation(() => {
        throw { response: { status: 504, data: {} } }
      }),
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    try {
      await result.current.send({ to: DESTINATION, asset: "XLM", amount: "10" })
    } catch (err) {
      capturedHash = (err as { hash?: string })?.hash
    }

    await waitFor(() => {
      expect(capturedHash).toBeDefined()
      expect(typeof capturedHash).toBe("string")
      expect(capturedHash).toHaveLength(64)
    })
  })

  test("tx_bad_seq produces SEQUENCE_MISMATCH", async () => {
    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue(makeSourceAccount()),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockResolvedValue({
        successful: false,
        hash: "abc123",
        extras: { result_codes: { transaction: "tx_bad_seq" } },
      }),
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null
    try {
      await result.current.send({ to: DESTINATION, asset: "XLM", amount: "10" })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("SEQUENCE_MISMATCH")
    })
  })
})
