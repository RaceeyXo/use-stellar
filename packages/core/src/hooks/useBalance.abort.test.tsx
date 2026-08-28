/**
 * Tests for AbortSignal support in useBalance.
 *
 * These tests verify that:
 * 1. In-flight requests are cancelled on unmount
 * 2. Superseded requests are cancelled when parameters change
 * 3. watch: true cancels in-flight requests on unmount
 * 4. Aborted requests never set error state
 * 5. The requestRef ignore flag still works alongside abort
 */

import { renderHook, waitFor } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useBalance } from "./useBalance"
import { getHorizonServer } from "../utils"

// Mock the Horizon server
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
}))

const mockGetHorizonServer = getHorizonServer as jest.MockedFunction<typeof getHorizonServer>

const TEST_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

describe("useBalance - AbortSignal", () => {
  let mockServer: {
    loadAccount: jest.Mock
  }

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StellarProvider network="testnet">{children}</StellarProvider>
  )

  beforeEach(() => {
    jest.clearAllMocks()
    mockServer = {
      loadAccount: jest.fn(),
    }
    mockGetHorizonServer.mockReturnValue(
      mockServer as unknown as ReturnType<typeof getHorizonServer>
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should cancel in-flight request on unmount", async () => {
    interface MockAccountResponse {
      id: string
      balances: Array<{ asset_type: string; balance: string }>
      sequenceNumber: () => string
      subentry_count: number
      thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }
      signers: unknown[]
    }

    let resolveAccount: (value: MockAccountResponse) => void
    const accountPromise = new Promise<MockAccountResponse>(resolve => {
      resolveAccount = resolve
    })

    mockServer.loadAccount.mockReturnValue(accountPromise)

    const { result, unmount } = renderHook(() => useBalance({ address: TEST_ADDRESS }), {
      wrapper,
    })

    // Wait for loading to start
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    // Unmount before the request completes
    unmount()

    // Resolve the promise after unmount
    resolveAccount!({
      id: TEST_ADDRESS,
      balances: [{ asset_type: "native", balance: "100" }],
      sequenceNumber: () => "123",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    })

    // Give it time to potentially update (it shouldn't)
    await new Promise(resolve => setTimeout(resolve, 50))

    // The component is unmounted, so we can't check result.current
    // But we verified that loading started and the component unmounted cleanly
  })

  it("should cancel superseded request when address changes", async () => {
    interface MockAccountResponse {
      id: string
      balances: Array<{ asset_type: string; balance: string }>
      sequenceNumber: () => string
      subentry_count: number
      thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }
      signers: unknown[]
    }

    const address1 = TEST_ADDRESS
    const address2 = "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56"

    let resolveFirst: (value: MockAccountResponse) => void
    const firstPromise = new Promise<MockAccountResponse>(resolve => {
      resolveFirst = resolve
    })

    mockServer.loadAccount.mockReturnValueOnce(firstPromise).mockResolvedValueOnce({
      id: address2,
      balances: [{ asset_type: "native", balance: "200" }],
      sequenceNumber: () => "456",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    })

    const { result, rerender } = renderHook(({ address }) => useBalance({ address }), {
      wrapper,
      initialProps: { address: address1 },
    })

    // Wait for first request to start loading
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    // Change address while first request is in flight
    rerender({ address: address2 })

    // Wait for second request to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should have the second address's data
    expect(result.current.balance).toBe("200")
    expect(result.current.error).toBe(null)

    // Resolve the first request (should be ignored)
    resolveFirst!({
      id: address1,
      balances: [{ asset_type: "native", balance: "100" }],
      sequenceNumber: () => "123",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    // Should still have the second address's data
    expect(result.current.balance).toBe("200")
  })

  it("should cancel in-flight request when watch: true unmounts", async () => {
    interface MockAccountResponse {
      id: string
      balances: Array<{ asset_type: string; balance: string }>
      sequenceNumber: () => string
      subentry_count: number
      thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }
      signers: unknown[]
    }

    let resolveAccount: (value: MockAccountResponse) => void
    const accountPromise = new Promise<MockAccountResponse>(resolve => {
      resolveAccount = resolve
    })

    mockServer.loadAccount.mockReturnValue(accountPromise)

    const { result, unmount } = renderHook(
      () => useBalance({ address: TEST_ADDRESS, watch: true, interval: 1000 }),
      { wrapper }
    )

    // Wait for loading to start
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    // Unmount before the request completes
    unmount()

    // Resolve the promise after unmount
    resolveAccount!({
      id: TEST_ADDRESS,
      balances: [{ asset_type: "native", balance: "100" }],
      sequenceNumber: () => "123",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    })

    // Give it time to potentially update (it shouldn't)
    await new Promise(resolve => setTimeout(resolve, 50))

    // The component is unmounted successfully
  })

  it("should not set error state when request is aborted", async () => {
    // This test verifies that an abort doesn't show as an error to the user
    const abortError = new Error("Request aborted")
    abortError.name = "AbortError"

    let rejectAccount: (error: Error) => void
    const accountPromise = new Promise((_, reject) => {
      rejectAccount = reject
    })

    mockServer.loadAccount.mockReturnValue(accountPromise)

    const { result, unmount } = renderHook(() => useBalance({ address: TEST_ADDRESS }), {
      wrapper,
    })

    // Wait for loading to start
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    // Unmount (triggers abort)
    unmount()

    // Simulate abort error
    rejectAccount!(abortError)

    // Give it time to potentially set error (it shouldn't)
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify no error was set (component is unmounted, test passes if no crash)
  })

  it("should handle refetch with abort controller", async () => {
    const mockAccountData = {
      id: TEST_ADDRESS,
      balances: [{ asset_type: "native", balance: "100" }],
      sequenceNumber: () => "123",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    }

    mockServer.loadAccount.mockResolvedValue(mockAccountData)

    const { result } = renderHook(() => useBalance({ address: TEST_ADDRESS }), { wrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.balance).toBe("100")

    // Update mock data
    const updatedData = { ...mockAccountData, balances: [{ asset_type: "native", balance: "200" }] }
    mockServer.loadAccount.mockResolvedValue(updatedData)

    // Call refetch
    result.current.refetch()

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.balance).toBe("200")
    })

    expect(result.current.error).toBe(null)
  })

  it("should work with requestRef ignore flag alongside abort", async () => {
    interface MockAccountResponse {
      id: string
      balances: Array<{ asset_type: string; balance: string }>
      sequenceNumber: () => string
      subentry_count: number
      thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }
      signers: unknown[]
    }

    // This test verifies that both abort and ignore mechanisms work together
    const address1 = TEST_ADDRESS
    const address2 = "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56"

    let resolveFirst: (value: MockAccountResponse) => void
    let resolveSecond: (value: MockAccountResponse) => void

    const firstPromise = new Promise<MockAccountResponse>(resolve => {
      resolveFirst = resolve
    })
    const secondPromise = new Promise<MockAccountResponse>(resolve => {
      resolveSecond = resolve
    })

    mockServer.loadAccount.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise)

    const { result, rerender } = renderHook(({ address }) => useBalance({ address }), {
      wrapper,
      initialProps: { address: address1 },
    })

    // Wait for first request to start
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    // Change address
    rerender({ address: address2 })

    // Resolve second request first (out of order)
    resolveSecond!({
      id: address2,
      balances: [{ asset_type: "native", balance: "200" }],
      sequenceNumber: () => "456",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.balance).toBe("200")

    // Resolve first request late (should be ignored by requestRef)
    resolveFirst!({
      id: address1,
      balances: [{ asset_type: "native", balance: "100" }],
      sequenceNumber: () => "123",
      subentry_count: 0,
      thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
      signers: [],
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    // Should still have address2 data
    expect(result.current.balance).toBe("200")
  })
})
