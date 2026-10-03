import type { NetworkConfig } from "../types"
import { fetchAccount, fetchAccountExists } from "./account"
import { horizonError, NOT_FOUND } from "../__tests__/fixtures/horizon-errors"
import { StellarError } from "../errors"

const MOCK_SERVER = {
  loadAccount: jest.fn(),
}

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: () => MOCK_SERVER,
}))

describe("queries/account", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockConfig = {
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  } as unknown as NetworkConfig

  describe("fetchAccount", () => {
    it("returns account info on success", async () => {
      MOCK_SERVER.loadAccount.mockResolvedValueOnce({
        id: "G123",
        sequenceNumber: () => "456",
        balances: [{ asset_type: "native", balance: "10.0" }],
        subentry_count: 1,
        thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
        signers: [{ key: "G123", weight: 1, type: "ed25519_public_key" }],
      })
      const res = await fetchAccount(mockConfig, { address: "G123" })
      expect(res.address).toBe("G123")
      expect(res.sequence).toBe("456")
      expect(res.balances[0].asset).toBe("XLM")
      expect(res.thresholds.medThreshold).toBe(2)
    })

    it("throws StellarError on failure", async () => {
      MOCK_SERVER.loadAccount.mockRejectedValueOnce(horizonError(NOT_FOUND))
      await expect(fetchAccount(mockConfig, { address: "G123" })).rejects.toThrow(StellarError)
    })

    it("throws abort error if aborted", async () => {
      MOCK_SERVER.loadAccount.mockRejectedValueOnce(new Error("Network Error"))
      const controller = new AbortController()
      controller.abort()
      await expect(
        fetchAccount(mockConfig, { address: "G123" }, { signal: controller.signal })
      ).rejects.toThrow("Network Error")
    })
  })

  describe("fetchAccountExists", () => {
    it("returns exists: true when found", async () => {
      MOCK_SERVER.loadAccount.mockResolvedValueOnce({})
      const res = await fetchAccountExists(mockConfig, { address: "G123" })
      expect(res).toEqual({ exists: true, reason: "exists" })
    })

    it("maps 404 to not_funded", async () => {
      MOCK_SERVER.loadAccount.mockRejectedValueOnce(horizonError(NOT_FOUND))
      const res = await fetchAccountExists(mockConfig, { address: "G123" })
      expect(res).toEqual({ exists: false, reason: "not_funded" })
    })

    it("throws other errors", async () => {
      MOCK_SERVER.loadAccount.mockRejectedValueOnce(new Error("Other Error"))
      await expect(fetchAccountExists(mockConfig, { address: "G123" })).rejects.toThrow(
        "Other Error"
      )
    })
  })
})
