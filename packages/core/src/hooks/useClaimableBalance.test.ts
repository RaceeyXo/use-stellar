import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { StellarProvider } from "../context/StellarProvider"
import { useClaimableBalance } from "./useClaimableBalance"

// ── Mock ../utils ──────────────────────────────────────────────────────────
jest.mock("../utils", () => ({
  getHorizonServer: jest.fn(),
  isBrowser: jest.fn(() => true),
}))

import { getHorizonServer } from "../utils"

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

const mockGetHorizonServer = getHorizonServer as jest.Mock

const mockCall = jest.fn()
const mockClaimant = jest.fn(() => ({ call: mockCall }))
const mockClaimableBalances = jest.fn(() => ({ claimant: mockClaimant }))

// ── Test wrapper ───────────────────────────────────────────────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StellarProvider, { network: "testnet", children })
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const CLAIMABLE_ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

const MOCK_RECORD = {
  id: "000000000123abc",
  asset: "native",
  amount: "100.0000000",
  claimants: [{ destination: CLAIMABLE_ADDRESS, predicate: { unconditional: true } }],
  sponsor: undefined,
}

const MOCK_RECORD_WITH_SPONSOR = {
  ...MOCK_RECORD,
  id: "000000000456def",
  sponsor: "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  // Re-wire after clearAllMocks resets everything
  mockClaimant.mockImplementation(() => ({ call: mockCall }))
  mockClaimableBalances.mockImplementation(() => ({ claimant: mockClaimant }))
  mockGetHorizonServer.mockReturnValue({
    claimableBalances: mockClaimableBalances,
  })
})

describe("useClaimableBalance — no address", () => {
  it("returns empty balances and does not call Horizon when address is null", () => {
    const { result } = renderHook(() => useClaimableBalance({ address: null }), { wrapper })

    expect(result.current.balances).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockCall).not.toHaveBeenCalled()
  })
})

describe("useClaimableBalance — loading state", () => {
  it("sets loading=true while the request is in flight", async () => {
    mockCall.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.balances).toEqual([])
    expect(result.current.error).toBeNull()
  })
})

describe("useClaimableBalance — success state", () => {
  it("returns parsed balances when Horizon responds with records", async () => {
    mockCall.mockResolvedValue({ records: [MOCK_RECORD] })

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.balances).toHaveLength(1)

    const balance = result.current.balances[0]
    expect(balance.id).toBe(MOCK_RECORD.id)
    expect(balance.asset).toBe("native")
    expect(balance.amount).toBe("100.0000000")
    expect(balance.claimants).toHaveLength(1)
    expect(balance.claimants[0].destination).toBe(CLAIMABLE_ADDRESS)
    expect(balance.claimants[0].predicate).toEqual({ unconditional: true })
    expect(balance.sponsor).toBeUndefined()
  })

  it("maps the optional sponsor field when present", async () => {
    mockCall.mockResolvedValue({ records: [MOCK_RECORD_WITH_SPONSOR] })

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.balances[0].sponsor).toBe(MOCK_RECORD_WITH_SPONSOR.sponsor)
  })

  it("returns multiple records correctly", async () => {
    mockCall.mockResolvedValue({
      records: [MOCK_RECORD, MOCK_RECORD_WITH_SPONSOR],
    })

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.balances).toHaveLength(2)
  })
})

describe("useClaimableBalance — empty state", () => {
  it("returns empty array (not an error) when no claimable balances exist", async () => {
    mockCall.mockResolvedValue({ records: [] })

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.balances).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it("treats a 404 response as empty array, not an error", async () => {
    mockCall.mockRejectedValue(notFoundError())

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.balances).toEqual([])
    expect(result.current.error).toBeNull()
  })
})

describe("useClaimableBalance — error state", () => {
  it("sets error when Horizon returns a non-404 failure", async () => {
    mockCall.mockRejectedValue(new Error("Network timeout"))

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.balances).toEqual([])
  })

  it("maps non-Error throws to an UNKNOWN StellarError preserving the message", async () => {
    mockCall.mockRejectedValue("unexpected string error")

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error?.code).toBe("UNKNOWN")
    expect(result.current.error?.message).toBe("unexpected string error")
  })
})

describe("useClaimableBalance — refetch", () => {
  it("re-calls Horizon when refetch() is invoked", async () => {
    mockCall.mockResolvedValue({ records: [MOCK_RECORD] })

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockCall).toHaveBeenCalledTimes(1)

    await act(() => {
      result.current.refetch()
    })
    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(2))
  })

  it("clears a previous error on refetch", async () => {
    mockCall
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce({ records: [MOCK_RECORD] })

    const { result } = renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))

    await act(() => {
      result.current.refetch()
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.balances).toHaveLength(1)
  })
})

describe("useClaimableBalance — Horizon call shape", () => {
  it("calls claimableBalances().claimant(address).call()", async () => {
    mockCall.mockResolvedValue({ records: [] })

    renderHook(() => useClaimableBalance({ address: CLAIMABLE_ADDRESS }), { wrapper })

    await waitFor(() => expect(mockCall).toHaveBeenCalledTimes(1))

    expect(mockClaimableBalances).toHaveBeenCalledTimes(1)
    expect(mockClaimant).toHaveBeenCalledWith(CLAIMABLE_ADDRESS)
    expect(mockCall).toHaveBeenCalledTimes(1)
  })
})
