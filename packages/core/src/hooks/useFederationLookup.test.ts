import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useFederationLookup } from "./useFederationLookup"

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

const mockResolve = jest.fn()

// `jest.mock` is hoisted above the `const` above it, so the factory must not
// read `mockResolve` while evaluating — that hits the temporal dead zone.
// Referencing it inside a wrapper defers the read until the call happens.
jest.mock("@stellar/stellar-sdk", () => ({
  Federation: {
    Server: {
      resolve: (...args: unknown[]) => mockResolve(...args),
    },
  },
}))

type FederationResponse = {
  account_id: string
  stellar_address: string
  memo_type?: string
  memo?: string
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

const FEDERATED_ADDRESS = "alice*example.com"
const ACCOUNT_ID = "GCTQZ6K2A7JVUDDJFJXSDBM2QTEOGV7Z2XZ4Y3NQ7KXQWAVWS66LXBYJ"

describe("useFederationLookup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should resolve a federated address successfully", async () => {
    const response: FederationResponse = {
      stellar_address: FEDERATED_ADDRESS,
      account_id: ACCOUNT_ID,
      memo_type: "text",
      memo: "hello",
    }
    mockResolve.mockResolvedValue(response)

    const { result } = renderHook(() => useFederationLookup({ address: FEDERATED_ADDRESS }), {
      wrapper,
    })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith(FEDERATED_ADDRESS))

    expect(result.current.record).toEqual({
      stellarAddress: FEDERATED_ADDRESS,
      accountId: ACCOUNT_ID,
      memoType: "text",
      memo: "hello",
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("should return a validation error when address is malformed", async () => {
    const { result } = renderHook(() => useFederationLookup({ address: "alice.example.com" }), {
      wrapper,
    })

    expect(mockResolve).not.toHaveBeenCalled()
    expect(result.current.record).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  })

  it("should normalize an unknown federated address error", async () => {
    mockResolve.mockRejectedValue(notFoundError())

    const { result } = renderHook(() => useFederationLookup({ address: FEDERATED_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(mockResolve).toHaveBeenCalled())

    expect(result.current.record).toBeNull()
    expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
    expect(result.current.loading).toBe(false)
  })

  it("should skip fetching when address is null", () => {
    const { result } = renderHook(() => useFederationLookup({ address: null }), {
      wrapper,
    })

    expect(mockResolve).not.toHaveBeenCalled()
    expect(result.current.record).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
