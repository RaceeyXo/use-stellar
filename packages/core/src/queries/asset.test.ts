import type { NetworkConfig } from "../types"
import { fetchAsset } from "./asset"
import { horizonError, NOT_FOUND } from "../__tests__/fixtures/horizon-errors"
import { StellarError } from "../errors"

const MOCK_CALL = jest.fn()
const MOCK_SERVER = {
  assets: () => ({
    forCode: () => ({
      forIssuer: () => ({
        call: MOCK_CALL,
      }),
    }),
  }),
}

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: () => MOCK_SERVER,
}))

describe("queries/asset", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockConfig = {
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  } as unknown as NetworkConfig

  it("returns asset info when found", async () => {
    MOCK_CALL.mockResolvedValueOnce({
      records: [
        {
          asset_code: "USDC",
          asset_issuer: "G123",
          amount: "1000",
          num_accounts: 10,
          home_domain: "stellar.org",
          flags: { auth_required: false, auth_revocable: false, auth_immutable: true },
        },
      ],
    })

    const res = await fetchAsset(mockConfig, { code: "USDC", issuer: "G123" })
    expect(res.code).toBe("USDC")
    expect(res.supply).toBe("1000")
  })

  it("throws ASSET_NOT_FOUND if empty records", async () => {
    MOCK_CALL.mockResolvedValueOnce({ records: [] })
    const promise = fetchAsset(mockConfig, { code: "USDC", issuer: "G123" })
    await expect(promise).rejects.toThrow(StellarError)
    await expect(promise).rejects.toHaveProperty("code", "ASSET_NOT_FOUND")
  })

  it("throws mapped StellarError on network failure", async () => {
    MOCK_CALL.mockRejectedValueOnce(horizonError(NOT_FOUND))
    await expect(fetchAsset(mockConfig, { code: "USDC", issuer: "G123" })).rejects.toThrow(
      StellarError
    )
  })

  it("throws abort error if aborted", async () => {
    MOCK_CALL.mockRejectedValueOnce(new Error("Network Error"))
    const controller = new AbortController()
    controller.abort()
    await expect(
      fetchAsset(mockConfig, { code: "USDC", issuer: "G123" }, { signal: controller.signal })
    ).rejects.toThrow("Network Error")
  })
})
