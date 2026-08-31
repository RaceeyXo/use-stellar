/**
 * Tests for usePathPayment — Stellar's built-in swap.
 * The wallet adapter and Horizon are both mocked, so no network is needed.
 */

import React from "react"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import type { PathPaymentOptions, WalletState } from "../types"

/** Testnet-only addresses. */
const TEST_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const DESTINATION = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"
const TEST_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

let strictSendOps: Record<string, unknown>[] = []
let strictReceiveOps: Record<string, unknown>[] = []
let submitResponse: Record<string, unknown> = {}
let submitError: unknown = null
let signCalls = 0
/** The base fee Horizon reports; the fee strategy multiplies this. */
let baseFee = 100

jest.mock("@stellar/stellar-sdk", () => {
  class MockAsset {
    constructor(
      public readonly code: string,
      public readonly issuer?: string
    ) {}

    static native() {
      return new MockAsset("XLM")
    }
  }

  class MockTransactionBuilder {
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
      return { toXDR: () => "unsigned-xdr" }
    }

    static fromXDR(xdr: string) {
      return { xdr }
    }
  }

  return {
    Asset: MockAsset,
    TransactionBuilder: MockTransactionBuilder,
    BASE_FEE: "100",
    Networks: {
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    },
    Memo: { text: (value: string) => ({ value }) },
    Operation: {
      pathPaymentStrictSend: (op: Record<string, unknown>) => {
        strictSendOps.push(op)
        return op
      },
      pathPaymentStrictReceive: (op: Record<string, unknown>) => {
        strictReceiveOps.push(op)
        return op
      },
    },
  }
})

jest.mock("../utils", () => {
  const actual = jest.requireActual("../utils")

  return {
    ...actual,
    isBrowser: () => true,
    getHorizonServer: () => ({
      fetchBaseFee: async () => baseFee,
      loadAccount: async () => ({ accountId: () => TEST_ADDRESS }),
      submitTransaction: async () => {
        if (submitError) throw submitError
        return submitResponse
      },
    }),
  }
})

jest.mock("../wallets", () => {
  const actual = jest.requireActual("../wallets")

  return {
    ...actual,
    getWalletAdapter: () => ({
      metadata: { type: "freighter", name: "Freighter", supported: true },
      signTransaction: async () => {
        signCalls += 1
        return "signed-xdr"
      },
    }),
  }
})

let mockWalletState: WalletState

jest.mock("../context/StellarProvider", () => ({
  useStellarContext: () => ({
    network: "testnet",
    networkConfig: {
      network: "testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanUrl: "https://soroban-testnet.stellar.org",
    },
    wallet: mockWalletState,
    setWallet: jest.fn(),
    autoConnect: { enabled: false, persistAddress: false, storage: "local" as const },
    queryStore: { invalidate: jest.fn() },
  }),
}))

import { usePathPayment } from "./usePathPayment"

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>

const USDC = { code: "USDC", issuer: TEST_ISSUER }
const EURC = { code: "EURC", issuer: TEST_ISSUER }

/** A Horizon rejection carrying operation result codes. */
function horizonFailure(...operations: string[]) {
  return {
    response: {
      status: 400,
      data: { extras: { result_codes: { transaction: "tx_failed", operations } } },
    },
  }
}

beforeEach(() => {
  strictSendOps = []
  strictReceiveOps = []
  signCalls = 0
  baseFee = 100
  submitError = null
  submitResponse = { hash: "abc123", successful: true, ledger: 42 }

  mockWalletState = {
    connected: true,
    connecting: false,
    address: TEST_ADDRESS,
    network: "testnet",
    wallet: "freighter",
    walletName: "Freighter",
    error: null,
    walletNetwork: "testnet",
    walletNetworkPassphrase: "Test SDF Network ; September 2015",
  }
})

// ── Both modes ────────────────────────────────────────────────────────────────

describe("usePathPayment — modes", () => {
  it("builds a strict-send operation with the caller's bound", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    let outcome
    await act(async () => {
      outcome = await result.current.pathPayment({
        mode: "strictSend",
        destination: DESTINATION,
        sendAsset: "XLM",
        sendAmount: "100",
        destAsset: USDC,
        destMin: "24.7500000",
        path: [],
      })
    })

    expect(strictSendOps).toHaveLength(1)
    expect(strictSendOps[0]).toMatchObject({
      destination: DESTINATION,
      sendAmount: "100",
      destMin: "24.7500000",
    })
    expect(signCalls).toBe(1)
    expect(outcome).toMatchObject({ hash: "abc123", status: "success" })
    expect(result.current.result?.status).toBe("success")
  })

  it("builds a strict-receive operation with the caller's bound", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await result.current.pathPayment({
        mode: "strictReceive",
        destination: DESTINATION,
        sendAsset: "XLM",
        sendMax: "105",
        destAsset: USDC,
        destAmount: "90",
      })
    })

    expect(strictReceiveOps).toHaveLength(1)
    expect(strictReceiveOps[0]).toMatchObject({ sendMax: "105", destAmount: "90" })
  })
})

// ── Slippage bounds ───────────────────────────────────────────────────────────

describe("usePathPayment — slippage bounds", () => {
  it("refuses a strict-send call with no destMin", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    // A JavaScript caller can reach this shape; TypeScript cannot.
    const options = {
      mode: "strictSend",
      destination: DESTINATION,
      sendAsset: "XLM",
      sendAmount: "100",
      destAsset: USDC,
    } as unknown as PathPaymentOptions

    await act(async () => {
      await expect(result.current.pathPayment(options)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })

    expect(strictSendOps).toHaveLength(0)
    expect(signCalls).toBe(0)
  })

  it("refuses a strict-receive call with no sendMax", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    const options = {
      mode: "strictReceive",
      destination: DESTINATION,
      sendAsset: "XLM",
      destAsset: USDC,
      destAmount: "90",
    } as unknown as PathPaymentOptions

    await act(async () => {
      await expect(result.current.pathPayment(options)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })

    expect(strictReceiveOps).toHaveLength(0)
  })

  it("never substitutes a permissive default for a missing bound", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    const options = {
      mode: "strictSend",
      destination: DESTINATION,
      sendAsset: "XLM",
      sendAmount: "100",
      destAsset: USDC,
      destMin: "",
    } as unknown as PathPaymentOptions

    await act(async () => {
      await expect(result.current.pathPayment(options)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })

    // Nothing reached the network with destMin "0".
    expect(strictSendOps).toHaveLength(0)
  })
})

// ── Paths ─────────────────────────────────────────────────────────────────────

describe("usePathPayment — path", () => {
  it("accepts an empty path as a direct conversion", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await result.current.pathPayment({
        mode: "strictSend",
        destination: DESTINATION,
        sendAsset: "XLM",
        sendAmount: "100",
        destAsset: USDC,
        destMin: "24.75",
        path: [],
      })
    })

    expect(strictSendOps[0].path).toEqual([])
  })

  it("passes intermediate hops through", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await result.current.pathPayment({
        mode: "strictSend",
        destination: DESTINATION,
        sendAsset: "XLM",
        sendAmount: "100",
        destAsset: USDC,
        destMin: "24.75",
        path: [EURC],
      })
    })

    expect(strictSendOps[0].path).toHaveLength(1)
  })

  it("never falls back to XLM for an asset it does not recognise", async () => {
    const { result } = renderHook(() => usePathPayment(), { wrapper })

    const options = {
      mode: "strictSend",
      destination: DESTINATION,
      // An asset object missing its issuer must not become XLM.
      sendAsset: { code: "USDC" },
      sendAmount: "100",
      destAsset: USDC,
      destMin: "24.75",
    } as unknown as PathPaymentOptions

    await act(async () => {
      await expect(result.current.pathPayment(options)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })

    expect(strictSendOps).toHaveLength(0)
  })
})

// ── Slippage failures ─────────────────────────────────────────────────────────

describe("usePathPayment — slippage failures", () => {
  it("reports op_under_dest_min as a rate move, not a generic failure", async () => {
    submitError = horizonFailure("op_under_dest_min")

    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await expect(
        result.current.pathPayment({
          mode: "strictSend",
          destination: DESTINATION,
          sendAsset: "XLM",
          sendAmount: "100",
          destAsset: USDC,
          destMin: "24.75",
        })
      ).rejects.toMatchObject({ code: "TRANSACTION_FAILED" })
    })

    expect(result.current.error?.message).toMatch(/rate moved/)
    expect(result.current.error?.message).toMatch(/destMin/)
  })

  it("reports op_over_source_max as a rate move", async () => {
    submitError = horizonFailure("op_over_source_max")

    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await expect(
        result.current.pathPayment({
          mode: "strictReceive",
          destination: DESTINATION,
          sendAsset: "XLM",
          sendMax: "105",
          destAsset: USDC,
          destAmount: "90",
        })
      ).rejects.toMatchObject({ code: "TRANSACTION_FAILED" })
    })

    expect(result.current.error?.message).toMatch(/rate moved/)
    expect(result.current.error?.message).toMatch(/sendMax/)
  })
})

// ── Guards ────────────────────────────────────────────────────────────────────

describe("usePathPayment — guards", () => {
  it("refuses to run without a connected wallet", async () => {
    mockWalletState = { ...mockWalletState, connected: false, address: null }

    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await expect(
        result.current.pathPayment({
          mode: "strictSend",
          destination: DESTINATION,
          sendAsset: "XLM",
          sendAmount: "100",
          destAsset: USDC,
          destMin: "24.75",
        })
      ).rejects.toMatchObject({ code: "WALLET_NOT_CONNECTED" })
    })

    expect(signCalls).toBe(0)
  })

  it("refuses to run when the wallet is on a different network", async () => {
    mockWalletState = { ...mockWalletState, walletNetwork: "mainnet" }

    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await expect(
        result.current.pathPayment({
          mode: "strictSend",
          destination: DESTINATION,
          sendAsset: "XLM",
          sendAmount: "100",
          destAsset: USDC,
          destMin: "24.75",
        })
      ).rejects.toMatchObject({ code: "WRONG_NETWORK" })
    })

    expect(signCalls).toBe(0)
  })
})

// ── Status and reset ──────────────────────────────────────────────────────────

describe("usePathPayment — status and reset", () => {
  it("derives status from res.successful rather than assuming success", async () => {
    submitResponse = { hash: "abc123", successful: false, ledger: 42 }

    const { result } = renderHook(() => usePathPayment(), { wrapper })

    let outcome
    await act(async () => {
      outcome = await result.current.pathPayment({
        mode: "strictSend",
        destination: DESTINATION,
        sendAsset: "XLM",
        sendAmount: "100",
        destAsset: USDC,
        destMin: "24.75",
      })
    })

    expect(outcome).toMatchObject({ status: "failed" })
  })

  it("clears error and result", async () => {
    submitError = horizonFailure("op_under_dest_min")

    const { result } = renderHook(() => usePathPayment(), { wrapper })

    await act(async () => {
      await expect(
        result.current.pathPayment({
          mode: "strictSend",
          destination: DESTINATION,
          sendAsset: "XLM",
          sendAmount: "100",
          destAsset: USDC,
          destMin: "24.75",
        })
      ).rejects.toBeDefined()
    })

    expect(result.current.error).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
  })
})
