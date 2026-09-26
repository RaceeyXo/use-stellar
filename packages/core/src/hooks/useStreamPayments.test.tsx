import React from "react"
import { renderHook, act } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { useStreamPayments } from "./useStreamPayments"

// Mock the Horizon utilities so no real network/SSE connection is made.
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: jest.fn(),
}))

import { getHorizonServer } from "../utils"

const mockGetServer = getHorizonServer as jest.Mock
const ADDR = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

interface StreamOptions {
  onmessage?: (record: unknown) => void
  onerror?: (event: unknown) => void
}

/** A fluent Horizon `.payments()` builder whose `.stream()` is fully controllable. */
function createStreamingBuilder() {
  const closeFns: jest.Mock[] = []
  let lastOptions: StreamOptions | undefined

  const builder: {
    forAccount: jest.Mock
    cursor: jest.Mock
    stream: jest.Mock
  } = {
    forAccount: jest.fn(() => builder),
    cursor: jest.fn(() => builder),
    stream: jest.fn((options?: StreamOptions) => {
      lastOptions = options
      const close = jest.fn()
      closeFns.push(close)
      return close
    }),
  }

  return {
    builder,
    emitMessage: (record: unknown) => lastOptions?.onmessage?.(record),
    emitError: (event: unknown = new Event("error")) => lastOptions?.onerror?.(event),
    closeFns,
  }
}

function paymentRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "1",
    paging_token: "1",
    transaction_hash: "hash1",
    created_at: "2024-01-01T00:00:00Z",
    type: "payment",
    from: "GOTHER",
    to: ADDR,
    amount: "10.0000000",
    asset_type: "native",
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

beforeEach(() => {
  jest.useFakeTimers()
  mockGetServer.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

test("enabled: false opens no connection", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  renderHook(() => useStreamPayments({ address: ADDR, enabled: false }), { wrapper })

  expect(stream.builder.stream).not.toHaveBeenCalled()
})

test("opens a connection and normalizes incoming payments, newest first", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })

  expect(stream.builder.forAccount).toHaveBeenCalledWith(ADDR)
  expect(result.current.connected).toBe(true)

  act(() => {
    stream.emitMessage(paymentRecord({ id: "1", paging_token: "1" }))
  })
  act(() => {
    stream.emitMessage(paymentRecord({ id: "2", paging_token: "2" }))
  })

  expect(result.current.payments.map(p => p.id)).toEqual(["2", "1"])
  expect(result.current.cursor).toBe("2")
})

test("flipping enabled to false closes an open connection", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result, rerender } = renderHook(
    ({ enabled }) => useStreamPayments({ address: ADDR, enabled }),
    { wrapper, initialProps: { enabled: true } }
  )

  expect(stream.closeFns).toHaveLength(1)

  rerender({ enabled: false })

  expect(stream.closeFns[0]).toHaveBeenCalled()
  expect(result.current.connected).toBe(false)
})

test("stream closes on unmount", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { unmount } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })
  unmount()

  expect(stream.closeFns[0]).toHaveBeenCalled()
})

test("a deliberate close on unmount does not set an error", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result, unmount } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })
  unmount()

  expect(result.current.error).toBeNull()
})

test("reconnects with jittered backoff and resumes from the last seen cursor", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })

  act(() => {
    stream.emitMessage(paymentRecord({ id: "1", paging_token: "42" }))
  })
  expect(result.current.cursor).toBe("42")

  act(() => {
    stream.emitError()
  })
  expect(result.current.connected).toBe(false)
  expect(result.current.error).not.toBeNull()

  act(() => {
    jest.runAllTimers()
  })

  // A second stream() call was made to reconnect, resuming from cursor "42".
  expect(stream.builder.stream).toHaveBeenCalledTimes(2)
  expect(stream.builder.cursor).toHaveBeenLastCalledWith("42")
})

test("bounds the buffer to bufferSize, dropping the oldest records", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result } = renderHook(() => useStreamPayments({ address: ADDR, bufferSize: 2 }), {
    wrapper,
  })

  act(() => {
    stream.emitMessage(paymentRecord({ id: "1", paging_token: "1" }))
  })
  act(() => {
    stream.emitMessage(paymentRecord({ id: "2", paging_token: "2" }))
  })
  act(() => {
    stream.emitMessage(paymentRecord({ id: "3", paging_token: "3" }))
  })

  expect(result.current.payments.map(p => p.id)).toEqual(["3", "2"])
})

test("cursor: 'now' yields only payments that arrive after mount", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })

  expect(stream.builder.cursor).toHaveBeenCalledWith("now")
})

test("normalizes a Soroban invoke_host_function payment, not as a blank row", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })

  act(() => {
    stream.emitMessage(
      paymentRecord({
        id: "9",
        paging_token: "9",
        type: "invoke_host_function",
        from: "GOTHER",
        to: ADDR,
        amount: "5.0000000",
        asset_type: "native",
      })
    )
  })

  // invoke_host_function isn't one of normalizePayment's known branches, so it
  // falls through with the default direction/amount rather than throwing —
  // asserting the hook surfaces it instead of dropping it silently.
  expect(result.current.payments).toHaveLength(1)
  expect(result.current.payments[0].id).toBe("9")
})

test("reconnect() closes the current connection and opens a fresh one", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })

  act(() => {
    result.current.reconnect()
  })

  expect(stream.closeFns[0]).toHaveBeenCalled()
  expect(stream.builder.stream).toHaveBeenCalledTimes(2)
})

test("clear() empties the buffered payments without closing the connection", () => {
  const stream = createStreamingBuilder()
  mockGetServer.mockReturnValue({ payments: () => stream.builder })

  const { result } = renderHook(() => useStreamPayments({ address: ADDR }), { wrapper })

  act(() => {
    stream.emitMessage(paymentRecord({ id: "1", paging_token: "1" }))
  })
  expect(result.current.payments).toHaveLength(1)

  act(() => {
    result.current.clear()
  })

  expect(result.current.payments).toHaveLength(0)
  expect(stream.closeFns[0]).not.toHaveBeenCalled()
})
