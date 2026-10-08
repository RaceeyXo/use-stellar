import type { NetworkConfig } from "../types"
import { fetchClaimableBalance } from "./claimableBalance"
import { horizonError, NOT_FOUND } from "../__tests__/fixtures/horizon-errors"

const MOCK_CALL = jest.fn()
const MOCK_SERVER = {
  claimableBalances: () => ({
    claimant: () => ({
      call: MOCK_CALL,
    }),
  }),
}

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: () => MOCK_SERVER,
}))

describe("queries/claimableBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockConfig = {
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  } as unknown as NetworkConfig

  it("returns claimable balances", async () => {
    MOCK_CALL.mockResolvedValueOnce({
      records: [
        {
          id: "00000000cb",
          asset: "native",
          amount: "10.0",
          sponsor: "G123",
          claimants: [{ destination: "G456", predicate: {} }],
        },
      ],
    })

    const res = await fetchClaimableBalance(mockConfig, { address: "G456" })
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe("00000000cb")
  })

  it("returns empty array for 404 (not funded)", async () => {
    MOCK_CALL.mockRejectedValueOnce(horizonError(NOT_FOUND))
    const res = await fetchClaimableBalance(mockConfig, { address: "G456" })
    expect(res).toEqual([])
  })

  it("throws mapped StellarError for other errors", async () => {
    MOCK_CALL.mockRejectedValueOnce(new Error("Other Error"))
    await expect(fetchClaimableBalance(mockConfig, { address: "G456" })).rejects.toThrow(
      "Other Error"
    )
  })

  it("throws abort error if aborted", async () => {
    MOCK_CALL.mockRejectedValueOnce(new Error("Network Error"))
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchClaimableBalance(mockConfig, { address: "G456" }, { signal: controller.signal })
    ).rejects.toThrow("Network Error")
  })
})
