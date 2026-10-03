/* eslint-disable */
import { fetchFederationLookup } from "./federation"
import { Federation } from "@stellar/stellar-sdk"

jest.mock("@stellar/stellar-sdk", () => ({
  Federation: {
    Server: {
      resolve: jest.fn(),
    },
  },
}))

describe("queries/federation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns federation record", async () => {
    ;(Federation.Server.resolve as jest.Mock).mockResolvedValueOnce({
      account_id: "G123",
      memo_type: "id",
      memo: "12345",
    })

    const res = await fetchFederationLookup({ address: "bob*stellar.org" })
    expect(res.accountId).toBe("G123")
    expect(res.memoType).toBe("id")
    expect(res.memo).toBe("12345")
  })

  it("throws StellarError on failure", async () => {
    ;(Federation.Server.resolve as jest.Mock).mockRejectedValueOnce(new Error("Network error"))
    await expect(fetchFederationLookup({ address: "bob*stellar.org" })).rejects.toThrow(
      "Unable to reach the Stellar network"
    )
  })

  it("throws abort error if aborted", async () => {
    ;(Federation.Server.resolve as jest.Mock).mockRejectedValueOnce(new Error("Network error"))
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchFederationLookup({ address: "bob*stellar.org" }, { signal: controller.signal })
    ).rejects.toThrow("Network error")
  })
})
