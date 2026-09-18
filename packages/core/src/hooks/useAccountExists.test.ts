import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useAccountExists } from "./useAccountExists"

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
const INVALID_ADDRESS = "GINVALID"

describe("useAccountExists", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockServer.loadAccount.mockResolvedValue({})
  })

  it("should return idle when no address is provided", () => {
    const { result } = renderHook(() => useAccountExists({ address: null }), { wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.exists).toBe(null)
    expect(result.current.reason).toBe("idle")
    expect(result.current.error).toBe(null)
  })

  it("should return invalid_format and not call horizon when address is invalid", () => {
    const { result } = renderHook(() => useAccountExists({ address: INVALID_ADDRESS }), { wrapper })
    expect(result.current.loading).toBe(false)
    expect(result.current.exists).toBe(false)
    expect(result.current.reason).toBe("invalid_format")
    expect(result.current.error).toBe(null)
    expect(mockServer.loadAccount).not.toHaveBeenCalled()
  })

  it("should return exists when account is found on horizon", async () => {
    mockServer.loadAccount.mockResolvedValue({})
    const { result } = renderHook(() => useAccountExists({ address: TEST_ADDRESS }), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.exists).toBe(null)

    await waitFor(() => {
      expect(mockServer.loadAccount).toHaveBeenCalledWith(TEST_ADDRESS)
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.exists).toBe(true)
    expect(result.current.reason).toBe("exists")
    expect(result.current.error).toBe(null)
  })

  it("should return not_funded when account is not found on horizon (404)", async () => {
    mockServer.loadAccount.mockRejectedValue(notFoundError())

    const { result } = renderHook(() => useAccountExists({ address: TEST_ADDRESS }), { wrapper })

    await waitFor(() => {
      expect(mockServer.loadAccount).toHaveBeenCalled()
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.exists).toBe(false)
    expect(result.current.reason).toBe("not_funded")
    expect(result.current.error).toBe(null)
  })

  it("should return error when network error occurs", async () => {
    mockServer.loadAccount.mockRejectedValue(new Error("Network Error"))

    const { result } = renderHook(() => useAccountExists({ address: TEST_ADDRESS }), { wrapper })

    await waitFor(() => {
      expect(mockServer.loadAccount).toHaveBeenCalled()
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.exists).toBe(null)
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
  })
})
