/**
 * Tests for usePaymentPaths — Horizon path (quote) discovery.
 * Horizon is mocked so no network is needed.
 */

import React, { type ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { usePaymentPaths } from "./usePaymentPaths"

/** Testnet-only issuer. */
const TEST_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
/** Testnet-only account. */
const TEST_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"

interface HorizonPathRecord {
  source_amount: string
  destination_amount: string
  path: { asset_type: string; asset_code?: string; asset_issuer?: string }[]
}

let mockRecords: HorizonPathRecord[] = []
let mockError: Error | null = null
let strictSendCalls: unknown[][] = []
let strictReceiveCalls: unknown[][] = []
/** When set, requests block until this is released, so a test can control timing. */
let pending: { promise: Promise<void>; release: () => void } | null = null

function holdRequests() {
  let release: () => void = () => {}
  const promise = new Promise<void>(resolve => {
    release = resolve
  })
  pending = { promise, release }
}

// The shared SDK mock has no Asset, and the hook converts its asset props
// before it ever reaches Horizon.
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

  return { Asset: MockAsset }
})

jest.mock("../utils", () => {
  const actual = jest.requireActual("../utils")

  return {
    ...actual,
    getHorizonServer: () => ({
      strictSendPaths: (...args: unknown[]) => {
        strictSendCalls.push(args)
        return { call: makeCall() }
      },
      strictReceivePaths: (...args: unknown[]) => {
        strictReceiveCalls.push(args)
        return { call: makeCall() }
      },
    }),
  }
})

function makeCall() {
  return async () => {
    if (pending) await pending.promise
    if (mockError) throw mockError
    return { records: mockRecords }
  }
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
      },
      wallet: { address: null },
      setWallet: jest.fn(),
      autoConnect: { enabled: false, persistAddress: false, storage: "local" as const },
    }),
  }
})

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>

beforeEach(() => {
  mockRecords = []
  mockError = null
  strictSendCalls = []
  strictReceiveCalls = []
  pending = null
})

// ── Both modes ────────────────────────────────────────────────────────────────

describe("usePaymentPaths — modes", () => {
  it("queries strict-send paths and computes the rate", async () => {
    mockRecords = [
      {
        source_amount: "100.0000000",
        destination_amount: "25.0000000",
        path: [],
      },
    ]

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull())

    expect(strictSendCalls).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(result.current.paths).toHaveLength(1)
    expect(result.current.paths[0].rate).toBe("0.25")
    // An empty hop list means a direct market exists.
    expect(result.current.paths[0].path).toEqual([])
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  it("queries strict-receive paths", async () => {
    mockRecords = [
      {
        source_amount: "400.0000000",
        destination_amount: "90.0000000",
        path: [{ asset_type: "credit_alphanum4", asset_code: "EURC", asset_issuer: TEST_ISSUER }],
      },
    ]

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictReceive",
          sourceAsset: "XLM",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
          destinationAmount: "90",
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull())

    expect(strictReceiveCalls).toHaveLength(1)
    expect(result.current.paths[0].path).toEqual([{ code: "EURC", issuer: TEST_ISSUER }])
  })

  it("restricts strict-send results to what the destination can receive", async () => {
    renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
          destinationAddress: TEST_ADDRESS,
        }),
      { wrapper }
    )

    await waitFor(() => expect(strictSendCalls).toHaveLength(1))

    expect(strictSendCalls[0][2]).toBe(TEST_ADDRESS)
  })
})

// ── Required amounts ──────────────────────────────────────────────────────────

describe("usePaymentPaths — required amounts", () => {
  it("raises a validation error when strict-send has no sourceAmount", async () => {
    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/requires `sourceAmount`/)
    expect(strictSendCalls).toHaveLength(0)
  })

  it("raises a validation error when strict-receive has no destinationAmount", async () => {
    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictReceive",
          sourceAsset: "XLM",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
          destinationAmount: "",
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/requires `destinationAmount`/)
  })
})

// ── Ordering and rate precision ───────────────────────────────────────────────

describe("usePaymentPaths — ordering and rates", () => {
  it("sorts best rate first", async () => {
    mockRecords = [
      { source_amount: "100.0000000", destination_amount: "24.0000000", path: [] },
      { source_amount: "100.0000000", destination_amount: "26.5000000", path: [] },
      { source_amount: "100.0000000", destination_amount: "25.0000000", path: [] },
    ]

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.paths).toHaveLength(3))

    expect(result.current.paths.map(p => p.destinationAmount)).toEqual([
      "26.5000000",
      "25.0000000",
      "24.0000000",
    ])
  })

  it("computes the rate without float arithmetic", async () => {
    // 1/3 in floats is 0.3333333333333333; the string result must be exact to
    // 7 places and never carry float noise.
    mockRecords = [{ source_amount: "3.0000000", destination_amount: "1.0000000", path: [] }]

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "3",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.paths).toHaveLength(1))

    expect(result.current.paths[0].rate).toBe("0.3333333")
  })

  it("keeps precision on amounts a float would round", async () => {
    mockRecords = [{ source_amount: "0.0000001", destination_amount: "0.0000003", path: [] }]

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "0.0000001",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.paths).toHaveLength(1))

    expect(result.current.paths[0].rate).toBe("3")
  })
})

// ── No route ──────────────────────────────────────────────────────────────────

describe("usePaymentPaths — no route", () => {
  it("treats an empty path set as a normal result, not an error", async () => {
    mockRecords = []

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "NOROUTE", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull())

    expect(result.current.paths).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })
})

// ── Identity stability ────────────────────────────────────────────────────────

describe("usePaymentPaths — identity stability", () => {
  it("does not change the paths array identity when asset props are inline objects", async () => {
    mockRecords = [{ source_amount: "100.0000000", destination_amount: "25.0000000", path: [] }]

    const { result, rerender } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          // A new object literal on every render — the trap
          // usePaymentHistory falls into.
          sourceAsset: { code: "USDC", issuer: TEST_ISSUER },
          sourceAmount: "100",
          destinationAsset: { code: "EURC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.paths).toHaveLength(1))

    const firstPaths = result.current.paths
    const callsAfterFirstLoad = strictSendCalls.length

    rerender()
    rerender()

    expect(result.current.paths).toBe(firstPaths)
    expect(strictSendCalls).toHaveLength(callsAfterFirstLoad)
  })
})

// ── enabled: false ────────────────────────────────────────────────────────────

describe("usePaymentPaths — enabled", () => {
  it("issues no request when disabled", async () => {
    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
          enabled: false,
        }),
      { wrapper }
    )

    await new Promise(resolve => setTimeout(resolve, 20))

    expect(strictSendCalls).toHaveLength(0)
    expect(result.current.paths).toEqual([])
    expect(result.current.error).toBeNull()
  })
})

// ── Failures and races ────────────────────────────────────────────────────────

describe("usePaymentPaths — failures and races", () => {
  it("surfaces a failed request as an error and clears the quote", async () => {
    mockError = new Error("Network Error")

    const { result } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.paths).toEqual([])
    expect(result.current.lastUpdated).toBeNull()
  })

  it("ignores a response that lands after unmount", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    // Hold the request open until after the hook unmounts.
    holdRequests()
    mockRecords = [{ source_amount: "100.0000000", destination_amount: "25.0000000", path: [] }]

    const { unmount } = renderHook(
      () =>
        usePaymentPaths({
          mode: "strictSend",
          sourceAsset: "XLM",
          sourceAmount: "100",
          destinationAsset: { code: "USDC", issuer: TEST_ISSUER },
        }),
      { wrapper }
    )

    unmount()

    // Release the in-flight request now that nothing is listening.
    pending?.release()

    await new Promise(resolve => setTimeout(resolve, 10))

    // No "state update on an unmounted component" warning.
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
