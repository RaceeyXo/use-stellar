import { renderHook, act } from "@testing-library/react-hooks"
import { StellarProvider } from "../context/StellarProvider"
import { useStreamPayments } from "./useStreamPayments"

const mockClose = jest.fn()
const mockStream = jest.fn(() => mockClose)

jest.mock("@stellar/stellar-sdk", () => ({
  ...jest.requireActual("@stellar/stellar-sdk"),
  Server: jest.fn(() => ({
    payments: jest.fn(() => ({
      forAccount: jest.fn(() => ({
        cursor: jest.fn(() => ({
          stream: mockStream,
        })),
      })),
    })),
  })),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StellarProvider network="testnet">{children}</StellarProvider>
)

const mockPaymentRecord = {
  id: "123",
  transaction_hash: "abc",
  type: "payment",
  from: "G...",
  to: "G...",
  amount: "100",
  asset_type: "native",
  created_at: new Date().toISOString(),
}

describe("useStreamPayments", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should not start streaming when disabled", () => {
    renderHook(() => useStreamPayments({ enabled: false, address: "G..." }), {
      wrapper,
    })
    expect(mockStream).not.toHaveBeenCalled()
  })

  it("should start streaming when enabled", () => {
    renderHook(() => useStreamPayments({ address: "G..." }), { wrapper })
    expect(mockStream).toHaveBeenCalled()
  })

  it("should handle incoming payments", () => {
    const { result } = renderHook(() => useStreamPayments({ address: "G..." }), {
      wrapper,
    })

    act(() => {
      const onmessage = mockStream.mock.calls[0][0].onmessage
      onmessage(mockPaymentRecord)
    })

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.latest?.id).toBe("123")
  })

  it("should handle errors", () => {
    const { result } = renderHook(() => useStreamPayments({ address: "G..." }), {
      wrapper,
    })

    act(() => {
      const onerror = mockStream.mock.calls[0][0].onerror
      onerror(new Error("test error"))
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.streaming).toBe(false)
  })

  it("should stop and start the stream", () => {
    const { result } = renderHook(() => useStreamPayments({ address: "G..." }), {
      wrapper,
    })

    expect(result.current.streaming).toBe(true)

    act(() => {
      result.current.stop()
    })

    expect(result.current.streaming).toBe(false)
    expect(mockClose).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.start()
    })

    expect(result.current.streaming).toBe(true)
    expect(mockStream).toHaveBeenCalledTimes(2)
  })

  it("should clean up on unmount", () => {
    const { unmount } = renderHook(() => useStreamPayments({ address: "G..." }), { wrapper })

    unmount()
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("should not run on server (SSR)", () => {
    jest.spyOn(require("../utils"), "isBrowser").mockReturnValue(false)

    renderHook(() => useStreamPayments({ address: "G..." }), { wrapper })
    expect(mockStream).not.toHaveBeenCalled()

    jest.spyOn(require("../utils"), "isBrowser").mockReturnValue(true)
  })
})