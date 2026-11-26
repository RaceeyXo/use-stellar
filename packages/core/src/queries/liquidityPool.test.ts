import type { NetworkConfig } from "../types"
import { fetchLiquidityPool, liquidityPoolKey } from "./liquidityPool"
import { horizonError, NOT_FOUND, RATE_LIMIT_EXCEEDED } from "../__tests__/fixtures/horizon-errors"

const MOCK_CALL = jest.fn()
const MOCK_POOL_ID = jest.fn()
const MOCK_SERVER = {
  liquidityPools: () => ({
    liquidityPoolId: (id: string) => {
      MOCK_POOL_ID(id)
      return { call: MOCK_CALL }
    },
  }),
}

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: () => MOCK_SERVER,
}))

const POOL_ID = "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7"
const config = {
  network: "testnet",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
} as unknown as NetworkConfig

const record = {
  id: POOL_ID,
  fee_bp: 30,
  type: "constant_product",
  total_trustlines: "300",
  total_shares: "5000.0000000",
  reserves: [
    { asset: "native", amount: "1000.0000000" },
    {
      asset: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      amount: "250.0000000",
    },
  ],
  // Fields the library does not expose are dropped.
  paging_token: "ignored",
  last_modified_ledger: 1,
}

describe("queries/liquidityPool", () => {
  beforeEach(() => jest.clearAllMocks())

  it("fetches the pool by id and maps it to LiquidityPool", async () => {
    MOCK_CALL.mockResolvedValueOnce(record)
    await expect(fetchLiquidityPool(config, { poolId: POOL_ID })).resolves.toEqual({
      id: POOL_ID,
      fee_bp: 30,
      type: "constant_product",
      total_trustlines: "300",
      total_shares: "5000.0000000",
      reserves: record.reserves,
    })
    expect(MOCK_POOL_ID).toHaveBeenCalledWith(POOL_ID)
  })

  it.each([
    [NOT_FOUND, "ACCOUNT_NOT_FOUND"],
    [RATE_LIMIT_EXCEEDED, "RATE_LIMITED"],
  ])("maps Horizon errors to the same codes as the React hook (%#)", async (body, code) => {
    MOCK_CALL.mockRejectedValueOnce(horizonError(body))
    await expect(fetchLiquidityPool(config, { poolId: POOL_ID })).rejects.toMatchObject({ code })
  })

  it("rethrows the original error when the request was aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" })
    MOCK_CALL.mockRejectedValueOnce(abort)
    await expect(
      fetchLiquidityPool(config, { poolId: POOL_ID }, { signal: controller.signal })
    ).rejects.toBe(abort)
  })

  it("keys the cache by endpoint, network and pool id", () => {
    expect(liquidityPoolKey(config.horizonUrl, "testnet", POOL_ID)).toEqual([
      "liquidityPool",
      config.horizonUrl,
      "testnet",
      POOL_ID,
    ])
  })
})
