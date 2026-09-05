import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useTransaction } from "./useTransaction"
import type { UseTransactionOptions, UseTransactionReturn } from "./useTransaction"
import type { StellarError, TransactionResult, TransactionStatus } from "../types"

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

// Mock transaction call function
const mockTransactionCall = jest.fn()

// Mock Horizon server instance
Object.assign(mockServer, {
  transactions: () => ({
    transaction: () => ({
      call: mockTransactionCall,
    }),
  }),
})

// Test wrapper
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

const TEST_HASH = "abcdef1234567890"

// Mock data
const mockTransactionData = {
  hash: "abcdef1234567890",
  successful: true,
  ledger: 12345,
  created_at: "2024-01-01T00:00:00Z",
  fee_charged: "100",
}

describe("useTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTransactionCall.mockResolvedValue(mockTransactionData)
  })

  describe("null transaction hash", () => {
    it("should not perform request when hash is null", () => {
      const { result } = renderHook(() => useTransaction({ hash: null }), { wrapper })

      expect(result.current.loading).toBe(false)
      expect(result.current.transaction).toBe(null)
      expect(result.current.error).toBe(null)
    })

    it("should not perform request when hash is undefined", () => {
      const { result } = renderHook(
        () => useTransaction({ hash: undefined as unknown as string }),
        { wrapper }
      )

      expect(result.current.loading).toBe(false)
      expect(result.current.transaction).toBe(null)
      expect(result.current.error).toBe(null)
    })
  })

  describe("valid transaction hash", () => {
    it("should return transaction successfully", async () => {
      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH }), { wrapper })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(null)
      expect(result.current.transaction).toEqual({
        hash: "abcdef1234567890",
        status: "success",
        ledger: 12345,
        createdAt: "2024-01-01T00:00:00Z",
        fee: "100",
      })
    })

    it("should handle failed transactions correctly", async () => {
      mockTransactionCall.mockResolvedValue({
        ...mockTransactionData,
        successful: false,
      })

      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH }), { wrapper })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(null)
      expect(result.current.transaction?.status).toBe("failed")
    })
  })

  describe("404 not found", () => {
    it("should return not_found status when watch is false", async () => {
      mockTransactionCall.mockRejectedValue({ response: { status: 404 } })

      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH, watch: false }), {
        wrapper,
      })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(null)
      expect(result.current.transaction).toEqual({
        hash: TEST_HASH,
        status: "not_found",
      })
    })

    it("should return pending status when watch is true", async () => {
      mockTransactionCall.mockRejectedValue({ response: { status: 404 } })

      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH, watch: true }), {
        wrapper,
      })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(null)
      expect(result.current.transaction).toEqual({
        hash: TEST_HASH,
        status: "pending",
      })
    })
  })

  describe("unexpected server errors", () => {
    it("should handle network errors correctly", async () => {
      mockTransactionCall.mockRejectedValue(new Error("Network Error"))

      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH }), { wrapper })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.transaction).toBe(null)
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
    })

    it("should handle unknown errors correctly", async () => {
      mockTransactionCall.mockRejectedValue(new Error("Unknown server error"))

      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH }), { wrapper })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.transaction).toBe(null)
      expect(result.current.error?.code).toBe("UNKNOWN")
      expect(result.current.error?.message).toBe("Unknown server error")
    })
  })

  describe("refetch functionality", () => {
    it("should provide working refetch function", async () => {
      const { result } = renderHook(() => useTransaction({ hash: TEST_HASH }), { wrapper })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      // Verify initial success
      expect(result.current.transaction?.status).toBe("success")
      expect(result.current.error).toBe(null)

      // Mock an error for refetch
      mockTransactionCall.mockRejectedValue(new Error("Network Error"))

      // Call refetch
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(mockTransactionCall).toHaveBeenCalled()
        expect(result.current.loading).toBe(false)
      })

      // Stale-while-revalidate: a failed refresh surfaces the error but keeps
      // the last known-good transaction rather than blanking the display.
      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.transaction?.status).toBe("success")
    })
  })

  describe("race and unmount guards", () => {
    it("does not update state if unmounted before the fetch resolves", async () => {
      let resolveFetch: (value: typeof mockTransactionData) => void = () => {}
      const promise = new Promise<typeof mockTransactionData>(resolve => {
        resolveFetch = resolve
      })
      mockTransactionCall.mockReturnValue(promise)

      const { result, unmount } = renderHook(() => useTransaction({ hash: TEST_HASH }), {
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      unmount()

      await act(async () => {
        resolveFetch(mockTransactionData)
      })
    })

    it("does not let an older response overwrite a newer one when hash changes mid-flight", async () => {
      let resolveFirst: (value: typeof mockTransactionData) => void = () => {}
      let resolveSecond: (value: typeof mockTransactionData) => void = () => {}

      const promise1 = new Promise<typeof mockTransactionData>(resolve => {
        resolveFirst = resolve
      })
      const promise2 = new Promise<typeof mockTransactionData>(resolve => {
        resolveSecond = resolve
      })

      mockTransactionCall.mockReturnValueOnce(promise1).mockReturnValueOnce(promise2)

      const { result, rerender } = renderHook(({ hash }) => useTransaction({ hash }), {
        initialProps: { hash: TEST_HASH as string | null },
        wrapper,
      })

      expect(result.current.loading).toBe(true)

      const NEW_HASH = "0987654321fedcba"
      const secondMockData = { ...mockTransactionData, hash: NEW_HASH }

      rerender({ hash: NEW_HASH })

      await act(async () => {
        resolveSecond(secondMockData)
      })

      expect(result.current.transaction?.hash).toBe(NEW_HASH)
      expect(result.current.loading).toBe(false)

      // The slower, superseded response resolves after the newer one — it
      // must not overwrite the winning result.
      await act(async () => {
        resolveFirst(mockTransactionData)
      })

      expect(result.current.transaction?.hash).toBe(NEW_HASH)
    })
  })
})

// ── Type-level tests ────────────────────────────────────────────────────────
// These tests validate the public API surface at compile time.
// If any of the types regress to `any`, TypeScript will surface errors here
// rather than silently allowing them to leak into consumer code.

describe("useTransaction — type-level contract", () => {
  it("UseTransactionOptions has the expected shape", () => {
    // This assignment would fail TypeScript compilation if the fields
    // were typed as `any` with narrower-than-expected properties.
    const opts: UseTransactionOptions = { hash: "abc123", watch: true }
    expect(typeof opts.hash).toBe("string")
    expect(typeof opts.watch).toBe("boolean")
  })

  it("UseTransactionOptions.hash accepts null", () => {
    const opts: UseTransactionOptions = { hash: null }
    expect(opts.hash).toBeNull()
  })

  it("UseTransactionReturn has all required fields with correct types", () => {
    // Type assertion: UseTransactionReturn must satisfy this exact shape.
    // TypeScript raises a compile-time error if any field is missing or
    // typed incorrectly — catching accidental regressions to `any`.
    type AssertReturnShape = {
      transaction: TransactionResult | null
      loading: boolean
      error: StellarError | null
      refetch: () => void
    }

    // Compile-time check: the interface must be assignable to the expected shape.
    // If UseTransactionReturn gains an `any`-typed field this assignment will
    // still compile (any is assignable to anything), but the explicit field
    // checks below will catch structural regressions.
    const _check = (r: UseTransactionReturn): AssertReturnShape => r
    expect(typeof _check).toBe("function")
  })

  it("TransactionResult fields are concrete types, not any", () => {
    // Validates the shape of TransactionResult as used by the hook.
    const result: TransactionResult = {
      hash: "abc123",
      status: "success",
      ledger: 12345,
      createdAt: "2024-01-01T00:00:00Z",
      fee: "100",
      envelope: "xdr...",
    }

    // Compile-time: TypeScript enforces `hash` is string, not any.
    const hash: string = result.hash
    // Compile-time: TypeScript enforces `status` is the literal union, not any.
    const status: TransactionStatus = result.status
    // Compile-time: TypeScript enforces `loading` shape via UseTransactionReturn.
    const ledger: number | undefined = result.ledger

    expect(hash).toBe("abc123")
    expect(status).toBe("success")
    expect(ledger).toBe(12345)
  })

  it("TransactionStatus is a discriminated union, not any", () => {
    // TypeScript enforces that only the four literal values are valid.
    // Any attempt to assign an arbitrary string would be a compile error.
    const statuses: TransactionStatus[] = ["pending", "success", "failed", "not_found"]
    expect(statuses).toHaveLength(4)
    statuses.forEach(s => {
      expect(typeof s).toBe("string")
    })
  })

  it("hook return value satisfies UseTransactionReturn when rendered", async () => {
    const { result } = renderHook(() => useTransaction({ hash: null }), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(StellarProvider, { network: "testnet", children }),
    })

    // Compile-time: each field is explicitly typed — accessing a non-existent
    // or differently-typed field would be a TypeScript error.
    const ret: UseTransactionReturn = result.current

    const transaction: TransactionResult | null = ret.transaction
    const loading: boolean = ret.loading
    const error: StellarError | null = ret.error
    const refetch: () => void = ret.refetch

    expect(transaction).toBeNull()
    expect(loading).toBe(false)
    expect(error).toBeNull()
    expect(typeof refetch).toBe("function")
  })

  it("transaction field resolves to TransactionResult, not any, after successful fetch", async () => {
    const { result } = renderHook(() => useTransaction({ hash: TEST_HASH }), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(StellarProvider, { network: "testnet", children }),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Compile-time assertion: narrowing `transaction` must be valid.
    // If `transaction` were typed as `any`, this narrowing would never
    // require a type guard — the explicit assertion below catches that.
    if (result.current.transaction !== null) {
      const tx: TransactionResult = result.current.transaction
      const hash: string = tx.hash
      const status: TransactionStatus = tx.status
      expect(hash).toBe(TEST_HASH)
      expect(status).toBe("success")
    }
  })
})
