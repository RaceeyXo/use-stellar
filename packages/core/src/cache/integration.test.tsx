import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useBalance } from "../hooks/useBalance"
import { useAccount } from "../hooks/useAccount"

// Mock the entire @stellar/stellar-sdk module
jest.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn(),
  },
}))

jest.mock("../utils", () => {
  const mockServer = {}
  return {
    ...jest.requireActual("../utils"),
    getHorizonServer: () => mockServer,
    __mockServer: mockServer,
  }
})

// @ts-expect-error - import mocked internal state
import { __mockServer as mockServer } from "../utils"

const TEST_ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

const mockAccountData = {
  id: TEST_ADDRESS,
  sequenceNumber: () => "1234567890123456",
  subentry_count: 2,
  thresholds: {
    low_threshold: 1,
    med_threshold: 2,
    high_threshold: 3,
  },
  signers: [
    {
      key: TEST_ADDRESS,
      weight: 1,
      type: "ed25519_public_key",
    },
  ],
  balances: [
    {
      asset_type: "native",
      balance: "100.0000000",
    },
  ],
}

Object.assign(mockServer, {
  loadAccount: jest.fn(),
})

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

describe("Cache integration — request deduplication", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockServer.loadAccount.mockResolvedValue(mockAccountData)
  })

  it("deduplicates two useBalance calls for the same address", async () => {
    const { result: result1 } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })
    const { result: result2 } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
      expect(result2.current.loading).toBe(false)
    })

    // Both hooks see the data
    expect(result1.current.balance).toBe("100.0000000")
    expect(result2.current.balance).toBe("100.0000000")

    // But only ONE network request was made
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)
  })

  it("deduplicates useBalance and useAccount for the same address", async () => {
    // Both hooks call server.loadAccount under the hood
    const { result: balanceResult } = renderHook(() => useBalance({ address: TEST_ADDRESS }), {
      wrapper,
    })
    const { result: accountResult } = renderHook(() => useAccount({ address: TEST_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => {
      expect(balanceResult.current.loading).toBe(false)
      expect(accountResult.current.loading).toBe(false)
    })

    expect(balanceResult.current.balance).toBe("100.0000000")
    expect(accountResult.current.account?.address).toBe(TEST_ADDRESS)

    // Still only ONE network request for both hooks
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)
  })

  it("makes separate requests for different addresses", async () => {
    const ADDRESS_2 = "GBWKCJL7A6HXXPENMX6UAZGYSLAGV6MDYSZCOG2CMDJPIUOET3Q57B73"

    mockServer.loadAccount.mockImplementation((address: string) => {
      if (address === TEST_ADDRESS) {
        return Promise.resolve(mockAccountData)
      }
      return Promise.resolve({ ...mockAccountData, id: ADDRESS_2 })
    })

    const { result: result1 } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })
    const { result: result2 } = renderHook(() => useBalance({ address: ADDRESS_2 }), { wrapper })

    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
      expect(result2.current.loading).toBe(false)
    })

    // Different addresses = different keys = 2 requests
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)
    expect(mockServer.loadAccount).toHaveBeenCalledWith(TEST_ADDRESS)
    expect(mockServer.loadAccount).toHaveBeenCalledWith(ADDRESS_2)
  })

  it("serves from cache on unmount/remount within staleTime", async () => {
    const { result, unmount } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.balance).toBe("100.0000000")
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)

    // Unmount
    unmount()

    // Remount immediately (well within staleTime and gcTime)
    const { result: result2 } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

    await waitFor(() => {
      expect(result2.current.loading).toBe(false)
    })

    // Still served from cache — no second request
    expect(result2.current.balance).toBe("100.0000000")
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)
  })

  it("refetches when staleTime expires", async () => {
    // Create provider with very short staleTime
    function shortStaleTimeWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        StellarProvider,
        { network: "testnet", queryConfig: { staleTime: 100 } },
        children
      )
    }

    const { result: result1 } = renderHook(() => useBalance({ address: TEST_ADDRESS }), {
      wrapper: shortStaleTimeWrapper,
    })

    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
    })

    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)

    // Wait for staleTime to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Mount a second hook — data is now stale, should refetch
    const { result: result2 } = renderHook(() => useBalance({ address: TEST_ADDRESS }), {
      wrapper: shortStaleTimeWrapper,
    })

    await waitFor(() => {
      expect(result2.current.loading).toBe(false)
    })

    // Second request was made
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)
  })

  it("respects per-hook staleTime override", async () => {
    const { result: result1 } = renderHook(
      () => useBalance({ address: TEST_ADDRESS, staleTime: 0 }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result1.current.loading).toBe(false)
    })

    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)

    // Mount a second hook with staleTime: 0 (always refetch)
    const { result: result2 } = renderHook(
      () => useBalance({ address: TEST_ADDRESS, staleTime: 0 }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result2.current.loading).toBe(false)
    })

    // Second request was made because staleTime: 0
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)
  })
})
