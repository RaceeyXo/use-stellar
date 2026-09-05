import React from "react"
import { renderHook, act } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { useBalance } from "./useBalance"

// Mock the Horizon utilities so no real network call is made.
jest.mock("../utils", () => ({
  getHorizonServer: jest.fn(),
  parseHorizonBalance: (b: unknown) => b,
}))

import { getHorizonServer } from "../utils"

const mockGetServer = getHorizonServer as jest.Mock
const loadAccount = jest.fn()

const ADDR = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

function wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

// Flush the microtask queue so the async fetch settles under fake timers.
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  loadAccount.mockReset()
  loadAccount.mockResolvedValue({ balances: [{ asset: "XLM", balance: "100" }] })
  mockGetServer.mockReturnValue({ loadAccount })
})

afterEach(() => {
  jest.useRealTimers()
})

test("watch: false (default) fetches once and never sets an interval", async () => {
  renderHook(() => useBalance({ address: ADDR }), { wrapper })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(1)

  await act(async () => {
    jest.advanceTimersByTime(60_000)
  })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(1)
})

test("watch: true re-fetches every 10 seconds by default", async () => {
  renderHook(() => useBalance({ address: ADDR, watch: true }), { wrapper })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(1)

  await act(async () => {
    jest.advanceTimersByTime(10_000)
  })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(2)

  await act(async () => {
    jest.advanceTimersByTime(10_000)
  })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(3)
})

test("watch: true with interval: 5000 re-fetches every 5 seconds", async () => {
  renderHook(() => useBalance({ address: ADDR, watch: true, interval: 5_000 }), { wrapper })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(1)

  await act(async () => {
    jest.advanceTimersByTime(5_000)
  })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(2)

  // Less than one interval — no extra fetch.
  await act(async () => {
    jest.advanceTimersByTime(4_999)
  })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(2)
})

test("clears the interval on unmount (no further fetches)", async () => {
  const clearSpy = jest.spyOn(global, "clearInterval")
  const { unmount } = renderHook(() => useBalance({ address: ADDR, watch: true }), { wrapper })
  await flush()

  unmount()
  expect(clearSpy).toHaveBeenCalled()

  const callsBefore = loadAccount.mock.calls.length
  await act(async () => {
    jest.advanceTimersByTime(30_000)
  })
  await flush()
  expect(loadAccount).toHaveBeenCalledTimes(callsBefore)

  clearSpy.mockRestore()
})

test("exposes lastUpdated after a successful fetch", async () => {
  const { result } = renderHook(() => useBalance({ address: ADDR }), { wrapper })
  await flush()
  expect(result.current.lastUpdated).toBeInstanceOf(Date)
  expect(result.current.balance).toBe("100")
})
