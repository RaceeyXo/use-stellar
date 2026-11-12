import { mockHorizonServer, mockTransactionRecord } from "@stellar/stellar-sdk"
import { useTransaction } from "../index"
import { getAppState, setAppState, setOnline, renderHookWithStellar, waitFor } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

describe("useTransaction on React Native", () => {
  it("returns the web hook shape and stops at a final status", async () => {
    assertNoDomGlobals()
    mockHorizonServer.transactions.mockReturnValue({
      transaction: () => ({
        call: jest.fn().mockResolvedValue(mockTransactionRecord),
      }),
    })

    const { result, unmount } = renderHookWithStellar(() =>
      useTransaction({ hash: mockTransactionRecord.hash, watch: true })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.transaction?.status).toBe("success")
    })

    unmount()
  })

  it("keeps the last status across AppState background and NetInfo offline", async () => {
    const call = jest.fn().mockResolvedValue(mockTransactionRecord)
    mockHorizonServer.transactions.mockReturnValue({
      transaction: () => ({ call }),
    })

    const { result, unmount } = renderHookWithStellar(() =>
      useTransaction({ hash: mockTransactionRecord.hash, watch: true })
    )

    await waitFor(() => {
      expect(result.current.transaction?.status).toBe("success")
    })

    const fetchesBeforeBackground = call.mock.calls.length
    setAppState("background")
    expect(getAppState()).toBe("background")
    expect(result.current.transaction?.status).toBe("success")
    expect(call).toHaveBeenCalledTimes(fetchesBeforeBackground)

    setAppState("active")
    setOnline(false)
    call.mockRejectedValue(new Error("Network Error"))
    const fetchesBeforeOffline = call.mock.calls.length
    result.current.refetch()

    // Offline, a refetch starts no request at all — so there is no network
    // error to replace the last known status with.
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(call).toHaveBeenCalledTimes(fetchesBeforeOffline)
    expect(result.current.error).toBeNull()
    expect(result.current.transaction?.status).toBe("success")
    unmount()
  })
})
