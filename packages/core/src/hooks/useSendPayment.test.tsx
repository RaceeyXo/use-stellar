import React from "react"
import { renderHook, act } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import type { ReactNode } from "react"
import type { WalletState } from "../types"

// Mock the Stellar SDK and Freighter API
jest.mock("@stellar/stellar-sdk")
jest.mock("@stellar/freighter-api")
// Register the automock so the hook and `jest.requireMock("../wallets")` below
// share one instance — without this the hook keeps the real adapter and only
// the test's copy gets stubbed.
jest.mock("../wallets")

// One factory for "../utils" — a second `jest.mock` on the same path replaces
// the first, so the bare automock that used to sit above this was dead. Spread
// the real module for the untouched helpers, then override the two the tests
// drive: `isBrowser` must report true, and `getHorizonServer` must be a mock
// the tests can stub per case.
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  isBrowser: () => true,
  getHorizonServer: jest.fn(),
}))

// Mock the context to inject wallet state
const mockSetWallet = jest.fn()
let mockWalletState: WalletState = {
  connected: false,
  address: null,
  network: null,
  wallet: null,
  connecting: false,
  error: null,
  walletNetwork: null,
  walletName: null,
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
      },
      wallet: mockWalletState,
      setWallet: mockSetWallet,
    }),
  }
})

function createWrapper(network: "testnet" | "mainnet" = "testnet") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <StellarProvider network={network}>{children}</StellarProvider>
  }
}

describe("useSendPayment - Payment Flow", () => {
  beforeEach(() => {
    // Set up wallet state for a connected wallet
    mockWalletState = {
      connected: true,
      address: "GABC123",
      network: "testnet",
      wallet: "freighter",
      connecting: false,
      error: null,
      walletNetwork: "testnet",
      walletName: "Freighter",
    }

    // `moduleNameMapper` in jest.config.js redirects "@stellar/stellar-sdk" to
    // the manual mock in src/__mocks__, and that redirect applies to
    // `jest.requireActual` too — so pulling TransactionBuilder/Networks/
    // Operation off it yielded undefined and `Networks.TESTNET` threw.
    // Build exactly what useSendPayment imports instead.
    const mockTx = { toXDR: () => "unsigned_xdr" }
    const mockSignedTx = { toXDR: () => "signed_xdr" }

    // `fromXDR` is a static on TransactionBuilder, not an instance method.
    const TransactionBuilder = Object.assign(
      function TransactionBuilder() {
        const builder = {
          addOperation: () => builder,
          addMemo: () => builder,
          setTimeout: () => builder,
          build: () => mockTx,
        }
        return builder
      },
      { fromXDR: () => mockSignedTx }
    )

    const sdk = jest.requireMock("@stellar/stellar-sdk") as Record<string, unknown>
    sdk.TransactionBuilder = TransactionBuilder
    sdk.Networks = {
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    }
    sdk.BASE_FEE = "100"
    sdk.Operation = { payment: (opts: unknown) => opts }
    sdk.Memo = { text: (value: string) => ({ type: "text", value }) }
    sdk.Asset = Object.assign(
      function Asset(code: string, issuer: string) {
        return { code, issuer }
      },
      { native: () => ({ code: "XLM" }) }
    )

    // Mock getHorizonServer and its methods
    const { getHorizonServer } = jest.requireMock("../utils") as { getHorizonServer: jest.Mock }
    getHorizonServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
      }),
      submitTransaction: jest.fn().mockResolvedValue({
        hash: "tx_hash_123",
      }),
    })

    // Mock wallet adapter
    const { getWalletAdapter } = jest.requireMock("../wallets") as { getWalletAdapter: jest.Mock }
    getWalletAdapter.mockReturnValue({
      signTransaction: jest.fn().mockResolvedValue("signed_xdr"),
    })
  })

  it("should handle a successful payment", async () => {
    const { result } = renderHook(() => useSendPayment(), {
      wrapper: createWrapper("testnet"),
    })

    const paymentOpts = { to: "GDEST", amount: "10", asset: "XLM" as const }
    // Inside act(), or the hook's state updates have not been flushed by the
    // time the assertions below read `result.current`.
    await act(async () => {
      await result.current.send(paymentOpts)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.result).toEqual({
      hash: "tx_hash_123",
      status: "success",
    })
  })

  it("should handle a failed payment", async () => {
    const { getHorizonServer } = jest.requireMock("../utils") as { getHorizonServer: jest.Mock }
    getHorizonServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
      }),
      submitTransaction: jest.fn().mockRejectedValue(new Error("Submission failed")),
    })

    const { result } = renderHook(() => useSendPayment(), {
      wrapper: createWrapper("testnet"),
    })

    const paymentOpts = { to: "GDEST", amount: "10", asset: "XLM" as const }

    await act(async () => {
      await expect(result.current.send(paymentOpts)).rejects.toThrow("Submission failed")
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toBe("Submission failed")
    expect(result.current.result).toBeNull()
  })
})
