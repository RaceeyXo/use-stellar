import React from "react"
import { act, renderHook } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import type { ReactNode } from "react"
import type { WalletState } from "../types"

// Mock the Stellar SDK and Freighter API
jest.mock("@stellar/stellar-sdk", () => ({
  TransactionBuilder: class MockTransactionBuilder {
    addOperation() {
      return this
    }

    addMemo() {
      return this
    }

    setTimeout() {
      return this
    }

    build() {
      return { toXDR: () => "xdr" }
    }

    static fromXDR() {
      return { toXDR: () => "signed_xdr" }
    }
  },
  Networks: { PUBLIC: "Public Global Stellar Network ; September 2015", TESTNET: "Test SDF" },
  BASE_FEE: "100",
  Operation: { payment: jest.fn(() => ({})) },
  Asset: class MockAsset {
    static native() {
      return {}
    }
  },
  Memo: { text: jest.fn() },
}))
jest.mock("@stellar/freighter-api")
jest.mock("../wallets", () => ({ getWalletAdapter: jest.fn() }))

// Mock isBrowser to return true for these tests
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
  isBrowser: () => true,
  getHorizonServer: jest.fn(),
}))

// Mock the context to inject wallet state
const mockSetWallet = jest.fn()
const mockLoadAccount = jest.fn()
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
      queryStore: { invalidate: jest.fn() },
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
    jest.clearAllMocks()

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
    const mockTx = { toXDR: () => "unsigned_xdr", hash: () => Buffer.alloc(32) }
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
      loadAccount: mockLoadAccount.mockResolvedValue({
        sequenceNumber: () => "123",
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockResolvedValue({
        hash: "tx_hash_123",
        successful: true,
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
      fetchBaseFee: jest.fn().mockResolvedValue(100),
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

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
    ["a missing issuer", { code: "USDC" }],
    ["an empty issuer", { code: "USDC", issuer: "" }],
    ["a non-string issuer", { code: "USDC", issuer: 123 }],
    ["a missing code", { issuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }],
    ["a lowercase asset string", "usdc"],
  ])("rejects %s before loading the account", async (_description, asset) => {
    const { result } = renderHook(() => useSendPayment(), {
      wrapper: createWrapper("testnet"),
    })

    await act(async () => {
      await expect(
        result.current.send({
          to: "GDEST",
          amount: "10",
          // @ts-expect-error - malformed runtime input must be rejected at the hook boundary
          asset,
        })
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message:
          `Unsupported asset: ${JSON.stringify(asset)}. ` + `Pass "XLM" or { code, issuer }.`,
      })
    })

    expect(mockLoadAccount).not.toHaveBeenCalled()
  })
})
