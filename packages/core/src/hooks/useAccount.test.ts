import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useAccount } from "./useAccount"

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

/**
 * A realistic Horizon 404: the SDK always throws an error carrying the
 * response, never a bare message. Classification reads the structured fields.
 */
function notFoundError() {
  const error = new Error("Request failed with status code 404") as Error & {
    response: { status: number; data: { type: string; title: string; status: number } }
  }
  error.response = {
    status: 404,
    data: {
      type: "https://stellar.org/horizon-errors/not_found",
      title: "Resource Missing",
      status: 404,
    },
  }
  return error
}

// Mock Horizon server instance
Object.assign(mockServer, {
  loadAccount: jest.fn(),
})

// Test wrapper
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

const TEST_ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

// Mock data
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
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      balance: "250.5000000",
      limit: "1000.0000000",
    },
    {
      asset_type: "liquidity_pool_shares",
      balance: "50.0000000",
      liquidity_pool_id: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
    },
  ],
}

describe("useAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockServer.loadAccount.mockResolvedValue(mockAccountData)
  })

  describe("loading state", () => {
    it("should start in loading state when address is provided", async () => {
      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      expect(result.current.loading).toBe(true)
      expect(result.current.account).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it("should not load when no address is provided", () => {
      const { result } = renderHook(() => useAccount({ address: null }), { wrapper })

      expect(result.current.loading).toBe(false)
      expect(result.current.account).toBe(null)
      expect(result.current.error).toBe(null)
    })
  })

  describe("successful account retrieval", () => {
    it("should fetch account info successfully", async () => {
      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(null)
      expect(result.current.account).toEqual({
        address: TEST_ADDRESS,
        sequence: "1234567890123456",
        balances: [
          {
            asset: "XLM",
            balance: "100.0000000",
          },
          {
            asset: {
              code: "USDC",
              issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            },
            balance: "250.5000000",
            limit: "1000.0000000",
          },
          {
            asset: "liquidity_pool_shares",
            balance: "50.0000000",
            liquidityPoolId: "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7",
          },
        ],
        subentryCount: 2,
        thresholds: {
          lowThreshold: 1,
          medThreshold: 2,
          highThreshold: 3,
        },
        signers: [
          {
            key: TEST_ADDRESS,
            weight: 1,
            type: "ed25519_public_key",
          },
        ],
      })
    })
  })

  describe("error state", () => {
    it("should handle account not found error", async () => {
      mockServer.loadAccount.mockRejectedValue(notFoundError())

      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.account).toBe(null)
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
    })

    it("should handle network errors", async () => {
      mockServer.loadAccount.mockRejectedValue(new Error("Network Error"))

      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      // Nothing was ever fetched successfully here, so there is no good data to
      // keep — unlike the refetch case below.
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.account).toBe(null)
    })
  })

  describe("state transitions", () => {
    it("should transition from loading to success correctly", async () => {
      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      expect(result.current.loading).toBe(true)
      expect(result.current.account).toBe(null)
      expect(result.current.error).toBe(null)

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.account).toBeTruthy()
      expect(result.current.error).toBe(null)
    })

    it("should transition from loading to error correctly", async () => {
      mockServer.loadAccount.mockRejectedValue(notFoundError())

      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      expect(result.current.loading).toBe(true)
      expect(result.current.account).toBe(null)
      expect(result.current.error).toBe(null)

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.account).toBe(null)
      expect(result.current.error).toBeTruthy()
    })
  })

  describe("refetch functionality", () => {
    it("should provide working refetch function", async () => {
      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.account).toBeTruthy()
      expect(result.current.error).toBe(null)

      const accountBeforeFailure = result.current.account

      mockServer.loadAccount.mockRejectedValue(new Error("Network Error"))

      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)
        expect(result.current.loading).toBe(false)
      })

      // Stale-while-revalidate: the failed refetch keeps the last known-good
      // account in place and only surfaces the error.
      expect(result.current.account).toBe(accountBeforeFailure)
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.isStale).toBe(true)
    })
  })

  describe("stale-while-revalidate", () => {
    it("clears account immediately when the address changes, before the new fetch resolves", async () => {
      let resolveSecond: (value: unknown) => void = () => {}
      const promise2 = new Promise(resolve => {
        resolveSecond = resolve
      })
      mockServer.loadAccount.mockResolvedValueOnce(mockAccountData).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ address }) => useAccount({ address }), {
        initialProps: { address: TEST_ADDRESS },
        wrapper,
      })

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.account).toBeTruthy()

      const NEW_ADDRESS = "GBAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"
      rerender({ address: NEW_ADDRESS })

      // Cleared synchronously — before the new fetch has resolved.
      expect(result.current.account).toBeNull()

      await act(async () => {
        resolveSecond({ ...mockAccountData, id: NEW_ADDRESS })
      })

      expect(result.current.loading).toBe(false)
    })

    it("clears error and refreshes data on a subsequent successful refetch", async () => {
      mockServer.loadAccount.mockRejectedValueOnce(new Error("Network Error"))
      mockServer.loadAccount.mockResolvedValueOnce(mockAccountData)

      const { result } = renderHook(() => useAccount({ address: TEST_ADDRESS }), { wrapper })

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      expect(result.current.account).toBeNull()

      act(() => {
        result.current.refetch()
      })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBeNull()
      expect(result.current.account).toBeTruthy()
      expect(result.current.isStale).toBe(false)
    })
  })

  describe("stale responses and unmounting", () => {
    it("should not set state if unmounted before fetch resolves", async () => {
      let resolveFetch: (value: unknown) => void = () => {}
      const promise = new Promise(resolve => {
        resolveFetch = resolve
      })
      mockServer.loadAccount.mockReturnValue(promise)

      const { result, unmount } = renderHook(() => useAccount({ address: TEST_ADDRESS }), {
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      unmount()

      await act(async () => {
        resolveFetch(mockAccountData)
      })
    })

    it("should not overwrite newer results with older stale responses", async () => {
      let resolveFirst: (value: unknown) => void = () => {}
      let resolveSecond: (value: unknown) => void = () => {}

      const promise1 = new Promise(resolve => {
        resolveFirst = resolve
      })
      const promise2 = new Promise(resolve => {
        resolveSecond = resolve
      })

      mockServer.loadAccount.mockReturnValueOnce(promise1).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ address }) => useAccount({ address }), {
        initialProps: { address: TEST_ADDRESS },
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      const NEW_ADDRESS = "GBWKCJL7A6HXXPENMX6UAZGYSLAGV6MDYSZCOG2CMDJPIUOET3Q57B73"
      const secondMockData = { ...mockAccountData, id: NEW_ADDRESS }

      rerender({ address: NEW_ADDRESS })

      await act(async () => {
        resolveSecond(secondMockData)
      })

      expect(result.current.account?.address).toBe(NEW_ADDRESS)
      expect(result.current.loading).toBe(false)

      await act(async () => {
        resolveFirst(mockAccountData)
      })

      expect(result.current.account?.address).toBe(NEW_ADDRESS)
    })
  })
})
