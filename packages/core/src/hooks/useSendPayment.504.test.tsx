/**
 * useSendPayment — Horizon 504 handling.
 *
 * These tests assert on a real 64-character transaction hash computed before
 * submission, so they run against the real SDK's TransactionBuilder. Only the
 * Horizon server is stubbed, per test, via `getHorizonServer`.
 */

import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { useSendPayment } from "./useSendPayment"
import { StellarProvider } from "../context/StellarProvider"
import { QueryStore } from "../cache"
import type { WalletState } from "../types"

// The real SDK, reached from this file's module context so `requireActual`
// bypasses the moduleNameMapper entry that would otherwise substitute the thin
// local mock. The hash under test is only meaningful if the encoding is real.
jest.mock("@stellar/stellar-sdk", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const real = jest.requireActual<any>("@stellar/stellar-sdk")
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
jest.mock("../wallets", () => ({
  getWalletAdapter: jest.fn(() => ({
    signTransaction: jest.fn(xdr => Promise.resolve(xdr)),
  })),
}))

const mockWalletState: WalletState = {
  connected: true,
  address: "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
  network: "testnet",
  wallet: "freighter",
  connecting: false,
  error: null,
  walletNetwork: "testnet",
  walletName: "Freighter",
}

let mockQueryStore = new QueryStore()

// Must stay at module scope: a `jest.mock` inside `describe` runs after this
// file's imports have already resolved, so it would never take effect.
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
      queryStore: mockQueryStore,
      autoConnect: {
        enabled: false,
        persistAddress: false,
        storage: "local" as const,
      },
    }),
  }
})

import { getHorizonServer } from "../utils"

const mockGetServer = getHorizonServer as jest.Mock

describe("useSendPayment - 504 Gateway Timeout handling", () => {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <StellarProvider network="testnet">{children}</StellarProvider>
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockQueryStore = new QueryStore()
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
        accountId: () => "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
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
        accountId: () => "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
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
        accountId: () => "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
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
        accountId: () => "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    try {
      await result.current.send({
        to: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
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
        accountId: () => "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5",
        incrementSequenceNumber: jest.fn(),
      }),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: mockSubmit,
    })

    const { result } = renderHook(() => useSendPayment(), { wrapper: Wrapper })

    let caughtError: Error | null = null

    try {
      await result.current.send({
        to: "GBEQQBQZ7YLVNCW6IVJ4H2JCKV3GDGGTURZIBDCHB2SEBXDFJJZPV5VV",
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
