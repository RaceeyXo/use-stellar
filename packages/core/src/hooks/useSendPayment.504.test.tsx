import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import type { WalletState } from "../types"

// Use the real SDK so TransactionBuilder/Operation/Asset/Memo can build a
// genuine transaction; only the Horizon.Server constructor is mocked, keeping
// network calls local. Loaded by relative file path to bypass the jest
// moduleNameMapper (jest.requireActual would return the manual mock here).
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
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  isBrowser: () => true,
  getHorizonServer: jest.fn(),
}))

// Mock wallet adapter
jest.mock("../wallets", () => ({ getWalletAdapter: jest.fn() }))

import { getHorizonServer } from "../utils"
import { getWalletAdapter } from "../wallets"

const mockGetServer = getHorizonServer as jest.Mock
const mockGetWalletAdapter = getWalletAdapter as jest.Mock

// Mock the context at file scope (a jest.mock nested inside describe is not
// reliably applied), so the hook reads an injected connected wallet rather
// than the real provider's default disconnected state.
const mockWalletState: WalletState = {
  connected: true,
  address: "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
  network: "testnet",
  wallet: "freighter",
  connecting: false,
  error: null,
  walletNetwork: "testnet",
  walletName: "Freighter",
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
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
      autoConnect: {
        enabled: false,
        persistAddress: false,
        storage: "local" as const,
      },
    }),
  }
})

describe("useSendPayment - 504 Gateway Timeout handling", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetWalletAdapter.mockReturnValue({
      signTransaction: jest.fn((xdr: string) => Promise.resolve(xdr)),
    })
  })

  test("HTTP 504 produces TX_TIMEOUT with transaction hash", async () => {
    const mockSubmit = jest.fn().mockRejectedValue({
      response: {
        status: 504,
        data: {
          type: "https://stellar.org/horizon-errors/timeout",
          title: "Gateway Timeout",
          status: 504,
        },
      },
    })

    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
        accountId: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I",
        asset: "XLM",
        amount: "10",
      })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("TX_TIMEOUT")
      expect((caughtError as { hash?: string })?.hash).toBeDefined()
      expect(typeof (caughtError as { hash?: string })?.hash).toBe("string")
      expect((caughtError as { hash?: string })?.hash).toHaveLength(64) // Transaction hash is 64 hex characters
    })
  })

  test("genuine network failure (no response) produces NETWORK_ERROR", async () => {
    const mockSubmit = jest.fn().mockRejectedValue(new Error("Network request failed"))

    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
        accountId: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I",
        asset: "XLM",
        amount: "10",
      })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("NETWORK_ERROR")
      expect((caughtError as { hash?: string })?.hash).toBeUndefined() // No hash for genuine network failures
    })
  })

  test("502 Bad Gateway produces NETWORK_ERROR, not TX_TIMEOUT", async () => {
    const mockSubmit = jest.fn().mockRejectedValue({
      response: {
        status: 502,
        data: {
          type: "https://stellar.org/horizon-errors/bad_gateway",
          title: "Bad Gateway",
          status: 502,
        },
      },
    })

    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
        accountId: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I",
        asset: "XLM",
        amount: "10",
      })
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

    const mockSubmit = jest.fn().mockImplementation(() => {
      // This simulates a 504 happening during submission
      throw {
        response: {
          status: 504,
          data: {},
        },
      }
    })

    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
        accountId: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    try {
      await result.current.send({
        to: "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I",
        asset: "XLM",
        amount: "10",
      })
    } catch (err) {
      capturedHash = (err as { hash?: string })?.hash
    }

    await waitFor(() => {
      expect(capturedHash).toBeDefined()
      expect(typeof capturedHash).toBe("string")
      // The hash should be available even though submission threw
      expect(capturedHash).toHaveLength(64)
    })
  })

  test("tx_bad_seq produces SEQUENCE_MISMATCH", async () => {
    const mockSubmit = jest.fn().mockResolvedValue({
      successful: false,
      hash: "abc123",
      extras: {
        result_codes: {
          transaction: "tx_bad_seq",
        },
      },
    })

    mockGetServer.mockReturnValue({
      loadAccount: jest.fn().mockResolvedValue({
        sequenceNumber: () => "123",
        accountId: () => "GBZFVO7IGDCRQWCIN27OWEG7QKTS5TPRGPPNQUKDZFHKWODM6JXUJRAQ",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GD2AG7BZ2INWOP7LBSXMW5SHL2RMHSETUVIVFYJBYIWNNYK2MCXQNT2I",
        asset: "XLM",
        amount: "10",
      })
    } catch (err) {
      caughtError = err as Error
    }

    await waitFor(() => {
      expect(caughtError).toBeDefined()
      expect((caughtError as { code?: string })?.code).toBe("SEQUENCE_MISMATCH")
    })
  })
})
