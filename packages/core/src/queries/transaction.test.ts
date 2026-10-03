import type { NetworkConfig } from "../types"
import { fetchTransaction } from "./transaction"
import { horizonError, NOT_FOUND } from "../__tests__/fixtures/horizon-errors"

const MOCK_CALL = jest.fn()
const MOCK_SERVER = {
  transactions: () => ({
    transaction: () => ({
      call: MOCK_CALL,
    }),
  }),
}

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: () => MOCK_SERVER,
}))

describe("queries/transaction", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockConfig = {
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  } as unknown as NetworkConfig

  it("returns success transaction info", async () => {
    MOCK_CALL.mockResolvedValueOnce({
      hash: "abc",
      successful: true,
      ledger: 100,
      created_at: "2023-01-01T00:00:00Z",
      fee_charged: "100",
      envelope_xdr: "AAAA...",
    })

    const res = await fetchTransaction(mockConfig, { hash: "abc" })
    expect(res.status).toBe("success")
    expect(res.ledger).toBe(100)
  })

  it("returns failed transaction info", async () => {
    MOCK_CALL.mockResolvedValueOnce({
      hash: "abc",
      successful: false,
      ledger: 100,
      created_at: "2023-01-01T00:00:00Z",
      fee_charged: "100",
      envelope_xdr: "AAAA...",
    })

    const res = await fetchTransaction(mockConfig, { hash: "abc" })
    expect(res.status).toBe("failed")
  })

  it("handles 404 when watch is true", async () => {
    MOCK_CALL.mockRejectedValueOnce(horizonError(NOT_FOUND))
    const res = await fetchTransaction(mockConfig, { hash: "abc", watch: true })
    expect(res.status).toBe("pending")
  })

  it("handles 404 when watch is false", async () => {
    MOCK_CALL.mockRejectedValueOnce(horizonError(NOT_FOUND))
    const res = await fetchTransaction(mockConfig, { hash: "abc", watch: false })
    expect(res.status).toBe("not_found")
  })

  it("throws StellarError for other errors", async () => {
    MOCK_CALL.mockRejectedValueOnce(new Error("Other Error"))
    await expect(fetchTransaction(mockConfig, { hash: "abc" })).rejects.toThrow("Other Error")
  })

  it("throws abort error if aborted", async () => {
    MOCK_CALL.mockRejectedValueOnce(new Error("Network error"))
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchTransaction(mockConfig, { hash: "abc" }, { signal: controller.signal })
    ).rejects.toThrow("Network error")
  })
})
