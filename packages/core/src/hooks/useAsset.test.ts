import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useAsset } from "./useAsset"

// Mock the entire @stellar/stellar-sdk module
jest.mock("@stellar/stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn(),
  },
}))

jest.mock("../utils", () => {
  // `resetMocks: true` in jest.config.js clears every mock's implementation
  // before each test, so `assets` has to be re-stubbed in beforeEach (below) or
  // it returns undefined. The intermediate links are plain functions so only
  // the two ends — `assets` and `call` — need restoring.
  const call = jest.fn()
  const chain = {
    forCode: () => ({
      forIssuer: () => ({ call }),
    }),
  }
  const mockServer = { assets: jest.fn(() => chain) }
  return {
    ...jest.requireActual("../utils"),
    getHorizonServer: () => mockServer,
    __mockServer: mockServer,
    __mockChain: chain,
    __mockCall: call,
  }
})

// Pull the mock internals off the registry rather than importing them: they are
// not real exports of "../utils", so a typed `import` cannot see them.
const {
  __mockServer: mockServer,
  __mockChain: mockChain,
  __mockCall: mockCall,
} = jest.requireMock("../utils") as {
  __mockServer: { assets: jest.Mock }
  __mockChain: unknown
  __mockCall: jest.Mock
}

// Test wrapper
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

const TEST_ASSET = {
  code: "USDC",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
}

// Mock data
const mockAssetData = {
  records: [
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      amount: "1000000.0000000",
      num_accounts: 100,
      flags: {
        auth_required: false,
        auth_revocable: false,
        auth_immutable: true,
      },
    },
  ],
}

describe("useAsset", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Restore what `resetMocks: true` wiped, and stub the leaf directly so the
    // test never calls `assets` itself — the call counts below belong to the
    // hook alone.
    mockServer.assets.mockReturnValue(mockChain)
    mockCall.mockResolvedValue(mockAssetData)
  })

  describe("initial loading state", () => {
    it("should start in loading state when asset info is provided", async () => {
      const { result } = renderHook(() => useAsset(TEST_ASSET), { wrapper })

      expect(result.current.loading).toBe(true)
      expect(result.current.asset).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it("should not load when autoFetch is false", () => {
      const { result } = renderHook(() => useAsset({ ...TEST_ASSET, autoFetch: false }), {
        wrapper,
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.asset).toBe(null)
      expect(result.current.error).toBe(null)
    })
  })

  describe("successful asset retrieval", () => {
    it("should fetch asset successfully", async () => {
      const { result } = renderHook(() => useAsset(TEST_ASSET), {
        wrapper,
      })

      await waitFor(() => {
        expect(mockServer.assets).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.asset).toEqual({
        code: "USDC",
        issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        supply: "1000000.0000000",
        numAccounts: 100,
        homeDomain: undefined,
        flags: {
          authRequired: false,
          authRevocable: false,
          authImmutable: true,
        },
      })
      expect(result.current.error).toBe(null)
    })
  })

  describe("error handling", () => {
    it("should handle asset not found error", async () => {
      mockCall.mockResolvedValue({ records: [] })

      const { result } = renderHook(() => useAsset(TEST_ASSET), { wrapper })

      await waitFor(() => {
        expect(mockServer.assets).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.asset).toBe(null)
      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
    })

    it("should handle unexpected SDK errors", async () => {
      mockCall.mockRejectedValue(new Error("Network Error"))

      const { result } = renderHook(() => useAsset(TEST_ASSET), { wrapper })

      await waitFor(() => {
        expect(mockServer.assets).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.asset).toBe(null)
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
    })
  })

  describe("refetch functionality", () => {
    it("should provide refetch function that works", async () => {
      const { result } = renderHook(() => useAsset(TEST_ASSET), { wrapper })

      await waitFor(() => {
        expect(mockServer.assets).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      // Verify initial success
      expect(result.current.asset?.code).toBe("USDC")
      expect(result.current.error).toBe(null)

      // Mock an error for refetch
      mockCall.mockRejectedValue(new Error("Network Error"))

      // Call refetch
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(mockServer.assets).toHaveBeenCalledTimes(2)
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error?.code).toBe("NETWORK_ERROR")
    })
  })
})
