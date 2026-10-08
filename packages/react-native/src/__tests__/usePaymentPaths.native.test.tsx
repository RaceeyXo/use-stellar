/**
 * usePaymentPaths on React Native
 * ───────────────────────────────
 * Renders the core `usePaymentPaths` hook (re-exported from this package)
 * inside the React Native StellarProvider, with Horizon mocked.
 *
 * Verifies:
 * - Both path modes return the same data as on web
 * - Quote polling pauses while the app is backgrounded (AppState)
 * - The return shape is identical to the web build
 * - No window, document, or react-dom access occurs
 */

import React from "react"
import { act, renderHook } from "@testing-library/react-native"
// Resolves to the same module as "@stellar/stellar-sdk" under Jest's moduleNameMapper.
import { Horizon } from "../../../core/src/__mocks__/@stellar/stellar-sdk"
import { StellarProvider, usePaymentPaths } from "../index"
import { setAppState } from "../test-utils"
import type { UsePaymentPathsOptions } from "use-stellar"

// react-dom must never load in a React Native bundle.
jest.mock(
  "react-dom",
  () => {
    throw new Error("react-dom must not be imported on React Native")
  },
  { virtual: true }
)

/** Testnet only. */
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const USDC = { code: "USDC", issuer: USDC_ISSUER }
const EURC = { code: "EURC", issuer: USDC_ISSUER }

/** Horizon path records, as `strictSendPaths/strictReceivePaths().call()` returns them. */
const RECORDS = [
  {
    source_amount: "10.0000000",
    destination_amount: "20.0000000",
    path: [],
  },
  {
    source_amount: "10.0000000",
    destination_amount: "25.0000000",
    path: [{ asset_type: "credit_alphanum4", asset_code: "EURC", asset_issuer: USDC_ISSUER }],
  },
]

/** What the web build produces for RECORDS: best rate first, rates exact. */
const EXPECTED_PATHS = [
  {
    path: [EURC],
    sourceAmount: "10.0000000",
    destinationAmount: "25.0000000",
    rate: "2.5",
  },
  {
    path: [],
    sourceAmount: "10.0000000",
    destinationAmount: "20.0000000",
    rate: "2",
  },
]

const HorizonServer = Horizon.Server as unknown as jest.Mock
const call = jest.fn()
const strictSendPaths = jest.fn(() => ({ call }))
const strictReceivePaths = jest.fn(() => ({ call }))

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <StellarProvider network="testnet" warnOnFallback={false}>
      {children}
    </StellarProvider>
  )
}

function renderPaths(options: UsePaymentPathsOptions) {
  return renderHook(() => usePaymentPaths(options), { wrapper })
}

/** Settles pending promises under fake timers. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  call.mockReset().mockResolvedValue({ records: RECORDS })
  HorizonServer.mockImplementation(() => ({ strictSendPaths, strictReceivePaths }))
})

describe("usePaymentPaths on React Native", () => {
  it("runs without window, document, or react-dom", async () => {
    expect("window" in globalThis).toBe(false)
    expect("document" in globalThis).toBe(false)

    const { result } = renderPaths({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "10",
      destinationAsset: USDC,
    })
    await flush()

    expect(result.current.error).toBeNull()
    expect(result.current.paths).toHaveLength(2)
  })

  it("strictSend returns the same data as on web", async () => {
    const { result } = renderPaths({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "10",
      destinationAsset: USDC,
    })
    await flush()

    expect(strictSendPaths).toHaveBeenCalledTimes(1)
    const [source, amount, destinations] = strictSendPaths.mock.calls[0] as unknown as [
      { isNative(): boolean },
      string,
      { code: string; issuer: string }[],
    ]
    expect(source.isNative()).toBe(true)
    expect(amount).toBe("10")
    expect(destinations[0]).toMatchObject({ code: "USDC", issuer: USDC_ISSUER })

    expect(result.current.paths).toEqual(EXPECTED_PATHS)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  it("strictReceive returns the same data as on web", async () => {
    const { result } = renderPaths({
      mode: "strictReceive",
      sourceAsset: "XLM",
      destinationAsset: USDC,
      destinationAmount: "25",
    })
    await flush()

    expect(strictReceivePaths).toHaveBeenCalledTimes(1)
    const [sources, destination, amount] = strictReceivePaths.mock.calls[0] as unknown as [
      { isNative(): boolean }[],
      { code: string; issuer: string },
      string,
    ]
    expect(sources[0].isNative()).toBe(true)
    expect(destination).toMatchObject({ code: "USDC", issuer: USDC_ISSUER })
    expect(amount).toBe("25")

    expect(result.current.paths).toEqual(EXPECTED_PATHS)
  })

  it("returns the same shape as the web build", async () => {
    const { result } = renderPaths({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "10",
      destinationAsset: USDC,
    })
    await flush()

    expect(Object.keys(result.current).sort()).toEqual([
      "error",
      "lastUpdated",
      "loading",
      "paths",
      "refetch",
    ])
    expect(typeof result.current.refetch).toBe("function")
  })

  it("pauses quote polling in the background and refreshes once on return", async () => {
    renderPaths({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "10",
      destinationAsset: USDC,
      watch: true,
      interval: 5_000,
    })
    await flush()
    expect(call).toHaveBeenCalledTimes(1)

    // Foreground: polls on the interval.
    act(() => jest.advanceTimersByTime(5_000))
    await flush()
    expect(call).toHaveBeenCalledTimes(2)

    // Background: no quote requests, however long the app stays there.
    act(() => setAppState("background"))
    act(() => jest.advanceTimersByTime(60_000))
    await flush()
    expect(call).toHaveBeenCalledTimes(2)

    // Foreground again: one catch-up request, then polling resumes.
    act(() => setAppState("active"))
    await flush()
    expect(call).toHaveBeenCalledTimes(3)

    act(() => jest.advanceTimersByTime(5_000))
    await flush()
    expect(call).toHaveBeenCalledTimes(4)
  })

  it("stops polling once unmounted", async () => {
    const { unmount } = renderPaths({
      mode: "strictSend",
      sourceAsset: "XLM",
      sourceAmount: "10",
      destinationAsset: USDC,
      watch: true,
      interval: 5_000,
    })
    await flush()
    unmount()

    act(() => jest.advanceTimersByTime(30_000))
    act(() => setAppState("background"))
    act(() => setAppState("active"))
    await flush()
    expect(call).toHaveBeenCalledTimes(1)
  })
})
