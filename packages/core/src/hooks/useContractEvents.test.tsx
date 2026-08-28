/**
 * Tests for useContractEvents — polling Soroban contract events.
 * The RPC is mocked, so no network is needed.
 */

import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import type { ReactNode } from "react"

/** Testnet-only contract ids. */
const CONTRACT_A = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"
const CONTRACT_B = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

interface StubEvent {
  id: string
  contractId: string
  ledger: number
  ledgerClosedAt: string
  pagingToken: string
  topic: string[]
  value: string
}

/** Each queued entry answers one `getEvents` call, in order. */
let responseQueue: { events: StubEvent[]; latestLedger: number }[] = []
let getEventsCalls: { filters: unknown[]; startLedger?: number; cursor?: string }[] = []
let getEventsError: Error | null = null
let latestLedgerCalls = 0

jest.mock("@stellar/stellar-sdk", () => {
  class MockServer {
    async getLatestLedger() {
      latestLedgerCalls += 1
      return { sequence: 1000 }
    }

    async getEvents(request: { filters: unknown[]; startLedger?: number; cursor?: string }) {
      getEventsCalls.push(request)
      if (getEventsError) throw getEventsError

      // Once the queue drains, the RPC keeps answering with nothing new.
      return responseQueue.shift() ?? { events: [], latestLedger: 1000 }
    }
  }

  return {
    SorobanRpc: { Server: MockServer },
    // Decoding is exercised through these two: a value the SDK understands
    // decodes, and anything tagged UNDECODABLE throws the way a
    // contract-defined shape the SDK does not know would.
    scValToNative: (value: { decoded?: unknown; fail?: boolean }) => {
      if (value?.fail) throw new Error("unknown ScVal discriminant")
      return value?.decoded
    },
    xdr: {
      ScVal: {
        fromXDR: (raw: string) =>
          raw.startsWith("UNDECODABLE")
            ? { fail: true, toXDR: () => raw }
            : { decoded: raw.replace(/^ok:/, ""), toXDR: () => raw },
      },
    },
  }
})

jest.mock("../context/StellarProvider", () => ({
  useStellarContext: () => ({
    network: "testnet",
    networkConfig: {
      network: "testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    wallet: { address: null },
    setWallet: jest.fn(),
    autoConnect: { enabled: false, persistAddress: false, storage: "local" as const },
  }),
}))

import { useContractEvents } from "./useContractEvents"

const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>

function stubEvent(overrides: Partial<StubEvent> & { id: string }): StubEvent {
  return {
    contractId: CONTRACT_A,
    ledger: 1001,
    ledgerClosedAt: "2026-08-27T00:00:00Z",
    pagingToken: `token-${overrides.id}`,
    topic: ["ok:transfer"],
    value: "ok:100",
    ...overrides,
  }
}

beforeEach(() => {
  responseQueue = []
  getEventsCalls = []
  getEventsError = null
  latestLedgerCalls = 0
})

// ── Fetching and decoding ──────────────────────────────────────────────────

describe("useContractEvents — fetching", () => {
  it("decodes topics and value, and exposes the raw XDR alongside", async () => {
    responseQueue = [
      {
        events: [stubEvent({ id: "1", topic: ["ok:transfer", "ok:from"], value: "ok:250" })],
        latestLedger: 1001,
      },
    ]

    const { result } = renderHook(() => useContractEvents({ contractIds: [CONTRACT_A] }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.events).toHaveLength(1))

    const event = result.current.events[0]
    expect(event.topics).toEqual(["transfer", "from"])
    expect(event.value).toBe("250")
    expect(event.raw).toEqual({ topics: ["ok:transfer", "ok:from"], value: "ok:250" })
    expect(event.contractId).toBe(CONTRACT_A)
    expect(result.current.latestLedger).toBe(1001)
  })

  it("falls back to raw XDR when a value cannot be decoded, rather than throwing", async () => {
    responseQueue = [
      {
        events: [stubEvent({ id: "1", value: "UNDECODABLE-payload" })],
        latestLedger: 1001,
      },
    ]

    const { result } = renderHook(() => useContractEvents({ contractIds: [CONTRACT_A] }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.events).toHaveLength(1))

    const event = result.current.events[0]
    // The event survives; the raw XDR is intact and the failure is flagged.
    expect(event.raw.value).toBe("UNDECODABLE-payload")
    expect(event.decodeFailed).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it("starts from the RPC's latest ledger when no startLedger is given", async () => {
    responseQueue = [{ events: [], latestLedger: 1000 }]

    renderHook(() => useContractEvents({ contractIds: [CONTRACT_A] }), { wrapper })

    await waitFor(() => expect(getEventsCalls).toHaveLength(1))

    expect(latestLedgerCalls).toBe(1)
    expect(getEventsCalls[0].startLedger).toBe(1000)
  })

  it("honours an explicit startLedger without asking for the latest", async () => {
    responseQueue = [{ events: [], latestLedger: 1000 }]

    renderHook(() => useContractEvents({ contractIds: [CONTRACT_A], startLedger: 900 }), {
      wrapper,
    })

    await waitFor(() => expect(getEventsCalls).toHaveLength(1))

    expect(getEventsCalls[0].startLedger).toBe(900)
    expect(latestLedgerCalls).toBe(0)
  })
})

// ── Cursor advancement ─────────────────────────────────────────────────────

describe("useContractEvents — cursor", () => {
  it("advances the cursor between polls instead of re-reading from startLedger", async () => {
    responseQueue = [
      { events: [stubEvent({ id: "1", pagingToken: "token-1" })], latestLedger: 1001 },
      { events: [stubEvent({ id: "2", pagingToken: "token-2" })], latestLedger: 1002 },
    ]

    const { result } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A], interval: 20 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.events).toHaveLength(2))

    expect(getEventsCalls.length).toBeGreaterThanOrEqual(2)
    // First call anchors the range; every later call continues from the cursor.
    expect(getEventsCalls[0].startLedger).toBe(1000)
    expect(getEventsCalls[0].cursor).toBeUndefined()
    expect(getEventsCalls[1].cursor).toBe("token-1")
    expect(getEventsCalls[1].startLedger).toBeUndefined()

    expect(result.current.events.map(e => e.id)).toEqual(["1", "2"])
  })

  it("does not deliver the same event twice when a provider replays it", async () => {
    const replayed = stubEvent({ id: "1", pagingToken: "token-1" })
    responseQueue = [
      { events: [replayed], latestLedger: 1001 },
      // The same event arrives again at the cursor boundary.
      { events: [replayed, stubEvent({ id: "2", pagingToken: "token-2" })], latestLedger: 1002 },
    ]

    const { result } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A], interval: 20 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.events).toHaveLength(2))

    expect(result.current.events.map(e => e.id)).toEqual(["1", "2"])
  })
})

// ── Retention window ───────────────────────────────────────────────────────

describe("useContractEvents — retention window", () => {
  it("reports a too-old startLedger as its own error with actionable guidance", async () => {
    getEventsError = new Error(
      "start ledger 1 is before the oldest ledger available on this server (12345)"
    )

    const { result } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A], startLedger: 1 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.error?.code).toBe("LEDGER_OUT_OF_RETENTION")
    expect(result.current.error?.message).toMatch(/archival RPC provider/)
  })

  it("leaves an unrelated RPC failure classified normally", async () => {
    getEventsError = new Error("Network Error")

    const { result } = renderHook(() => useContractEvents({ contractIds: [CONTRACT_A] }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.error?.code).toBe("NETWORK_ERROR")
  })
})

// ── Lifecycle ──────────────────────────────────────────────────────────────

describe("useContractEvents — lifecycle", () => {
  it("issues no request when disabled", async () => {
    renderHook(() => useContractEvents({ contractIds: [CONTRACT_A], enabled: false }), { wrapper })

    await new Promise(resolve => setTimeout(resolve, 30))

    expect(getEventsCalls).toHaveLength(0)
  })

  it("stops polling on unmount", async () => {
    const { unmount } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A], interval: 20 }),
      { wrapper }
    )

    await waitFor(() => expect(getEventsCalls.length).toBeGreaterThan(0))

    unmount()
    const callsAtUnmount = getEventsCalls.length

    await new Promise(resolve => setTimeout(resolve, 80))

    expect(getEventsCalls).toHaveLength(callsAtUnmount)
  })

  it("does not re-subscribe when contractIds is a new array with the same contents", async () => {
    const { result, rerender } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A, CONTRACT_B], interval: 10_000 }),
      { wrapper }
    )

    await waitFor(() => expect(getEventsCalls.length).toBeGreaterThan(0))
    const callsAfterFirstPoll = getEventsCalls.length

    // Every rerender passes a brand-new array literal — the trap bug-01
    // documents. It must not tear down and rebuild the subscription.
    rerender()
    rerender()

    await new Promise(resolve => setTimeout(resolve, 30))

    expect(getEventsCalls).toHaveLength(callsAfterFirstPoll)
    expect(result.current.error).toBeNull()
  })

  it("clears the buffer on demand without stopping the subscription", async () => {
    responseQueue = [{ events: [stubEvent({ id: "1" })], latestLedger: 1001 }]

    const { result } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A], interval: 10_000 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.events).toHaveLength(1))

    act(() => {
      result.current.clear()
    })

    expect(result.current.events).toEqual([])
  })
})

// ── Buffering ──────────────────────────────────────────────────────────────

describe("useContractEvents — buffer", () => {
  it("bounds the buffer, dropping the oldest events first", async () => {
    responseQueue = [
      {
        events: [
          stubEvent({ id: "1", pagingToken: "t1" }),
          stubEvent({ id: "2", pagingToken: "t2" }),
          stubEvent({ id: "3", pagingToken: "t3" }),
        ],
        latestLedger: 1001,
      },
    ]

    const { result } = renderHook(
      () => useContractEvents({ contractIds: [CONTRACT_A], bufferSize: 2, interval: 10_000 }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.events).toHaveLength(2))

    // The two most recent survive; the oldest is dropped.
    expect(result.current.events.map(e => e.id)).toEqual(["2", "3"])
  })
})
