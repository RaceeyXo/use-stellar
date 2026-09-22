// packages/core/src/hooks/usePaymentHistory.test.tsx

import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { usePaymentHistory } from "./usePaymentHistory"
import { StellarProvider } from "../context/StellarProvider"
import type { NormalizedPayment, UsePaymentsReturn } from "../types"

const TESTNET_ACCOUNT = "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5"
const USDC_ISSUER = "GDHHCCQQFR6THLXLZQWVU545C4IN42CZ2A3IPYHYMI4LKELGMWAPP7ZR"

jest.mock("./usePayments", () => ({ usePayments: jest.fn() }))

import { usePayments } from "./usePayments"

const mockUsePayments = usePayments as jest.MockedFunction<typeof usePayments>

/** One page as the fake source hook would hand it back. */
interface Page {
  payments: NormalizedPayment[]
  hasNext: boolean
}

/**
 * Install a stand-in for `usePayments` that pages like the real one:
 * `fetchNext()` advances to the next page and re-renders with a *fresh* array
 * identity, which is the signal `usePaymentHistory`'s accumulation effect keys
 * off. A static double never advances, so the accumulation loop under test
 * would stall on its first iteration and never settle.
 *
 * @returns the `fetchNext` spy, so tests can assert how many pages were pulled.
 */
function installPagingSource(pages: Page[]): jest.Mock {
  const fetchNext = jest.fn()

  mockUsePayments.mockImplementation((): UsePaymentsReturn => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [index, setIndex] = React.useState(0)
    const page = pages[Math.min(index, pages.length - 1)]

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const next = React.useCallback(async () => {
      fetchNext()
      setIndex(i => i + 1)
    }, [])

    return {
      payments: page.payments,
      loading: false,
      error: null,
      isStale: false,
      refetch: jest.fn(),
      fetchNext: next,
      fetchPrev: jest.fn(async () => {}),
      hasNext: page.hasNext,
      hasPrev: false,
    }
  })

  return fetchNext
}

/** A page of records that never match a `direction: "incoming"` filter. */
function nonMatchingPage(pageNumber: number): Page {
  return {
    payments: [{ id: `p${pageNumber}`, direction: "outgoing", asset: "XLM" } as NormalizedPayment],
    hasNext: true,
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

describe("usePaymentHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("filters by direction properly", async () => {
    installPagingSource([
      {
        payments: [
          { id: "1", direction: "incoming", asset: "XLM" },
          { id: "2", direction: "outgoing", asset: "XLM" },
        ] as NormalizedPayment[],
        hasNext: false,
      },
    ])

    const { result } = renderHook(
      () => usePaymentHistory({ address: TESTNET_ACCOUNT, direction: "incoming" }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments.length).toBe(1)
    expect(result.current.payments[0].id).toBe("1")
  })

  it("filters by asset and maintains identity stability for inline objects", async () => {
    const inlineAsset = { code: "USDC", issuer: USDC_ISSUER }

    installPagingSource([
      {
        payments: [
          { id: "1", asset: "XLM", direction: "incoming" },
          { id: "2", asset: { code: "USDC", issuer: USDC_ISSUER }, direction: "incoming" },
        ] as NormalizedPayment[],
        hasNext: false,
      },
    ])

    const { result, rerender } = renderHook(
      () => usePaymentHistory({ address: TESTNET_ACCOUNT, asset: inlineAsset }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments.length).toBe(1)
    expect(result.current.payments[0].id).toBe("2")

    const initialPaymentsRef = result.current.payments

    // Rerender with a NEW inline object reference that has the same primitive values
    rerender({ address: TESTNET_ACCOUNT, asset: { code: "USDC", issuer: USDC_ISSUER } })

    expect(result.current.payments).toBe(initialPaymentsRef) // Identity stability maintained
  })

  it("does not disable hasNext when a page has zero matches", async () => {
    // Every page has records, none of them incoming, and the source always
    // reports another page — so accumulation runs until it hits its bound.
    installPagingSource([1, 2, 3, 4, 5, 6].map(nonMatchingPage))

    const { result } = renderHook(
      () => usePaymentHistory({ address: TESTNET_ACCOUNT, direction: "incoming" }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.payments.length).toBe(0)
    expect(result.current.hasNext).toBe(true) // Should remain true, allowing fetchNext
  })

  it("observes the per-call request bound when accumulating", async () => {
    const fetchNext = installPagingSource([1, 2, 3, 4].map(nonMatchingPage))

    const { result } = renderHook(
      () =>
        usePaymentHistory({
          address: TESTNET_ACCOUNT,
          direction: "incoming",
          maxAccumulationPages: 3, // bound to 3 pages
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.accumulationBoundHit).toBe(true))

    // The loop should break and flag accumulationBoundHit rather than looping forever
    expect(result.current.payments.length).toBe(0)
    expect(result.current.hasNext).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(fetchNext).toHaveBeenCalledTimes(2) // Initial page counts as 1, calls fetchNext 2 times to hit 3
  })
})
