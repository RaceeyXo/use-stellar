import React from "react"
import { act, renderHook } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import type { ReactNode } from "react"
import type { WalletState } from "../types"

// Activates the manual mock at src/__mocks__/@stellar/stellar-sdk.ts which
// re-exports real TransactionBuilder/Asset/Operation/Memo/Networks from
// jest.requireActual. No factory needed — the manual mock handles everything.
jest.mock("@stellar/stellar-sdk")

jest.mock("@stellar/freighter-api")
jest.mock("../wallets", () => ({ getWalletAdapter: jest.fn() }))

// Mock isBrowser to return true for these tests
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
  isBrowser: () => true,
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
        networkPassphrase: "Test SDF Network ; September 2015",
      },
      wallet: mockWalletState,
      setWallet: mockSetWallet,
      queryStore: { invalidate: jest.fn() },
      autoConnect: { enabled: false, persistAddress: false, storage: "local" as const },
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
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
      network: "testnet",
      wallet: "freighter",
      connecting: false,
      error: null,
      walletNetwork: "testnet",
      walletName: "Freighter",
    }

    // Mock getHorizonServer with a source account that satisfies the
    // TransactionBuilder interface: accountId(), sequenceNumber(), and
    // incrementSequenceNumber() are all required.
    const { getHorizonServer } = jest.requireMock("../utils") as { getHorizonServer: jest.Mock }
    getHorizonServer.mockReturnValue({
      loadAccount: mockLoadAccount.mockResolvedValue({
        accountId: () => "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
        sequenceNumber: () => "123",
        incrementSequenceNumber: jest.fn(),
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
      signTransaction: jest.fn().mockResolvedValue(
        // A minimal valid-looking signed XDR string; TransactionBuilder.fromXDR
        // will parse it via the real SDK.  We return the unsigned XDR unchanged
        // here because the test's signTransaction mock just passes it through.
        "signed_xdr"
      ),
    })
  })

  it("should handle a successful payment", async () => {
    const { result } = renderHook(() => useSendPayment(), {
      wrapper: createWrapper("testnet"),
    })

    const paymentOpts = { to: "GDEST", amount: "10", asset: "XLM" as const }
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
        accountId: () => "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN",
        sequenceNumber: () => "123",
        incrementSequenceNumber: jest.fn(),
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
