import { ref } from "vue"
import * as core from "use-stellar/core"
import { StellarError, type LiquidityPool, type WalletState } from "use-stellar/core"
import { createStellarTestHarness, type StellarTestHarness } from "./test-utils"
import { useLiquidityPool, useLiquidityPoolActions } from "./useLiquidityPool"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchLiquidityPool: jest.fn(),
  depositLiquidity: jest.fn(),
  withdrawLiquidity: jest.fn(),
}))

const fetchLiquidityPool = core.fetchLiquidityPool as jest.MockedFunction<
  typeof core.fetchLiquidityPool
>
const depositLiquidity = core.depositLiquidity as jest.MockedFunction<typeof core.depositLiquidity>
const withdrawLiquidity = core.withdrawLiquidity as jest.MockedFunction<
  typeof core.withdrawLiquidity
>

const POOL_A = "a".repeat(64)
const POOL_B = "b".repeat(64)
const pool = (id: string): LiquidityPool => ({
  id,
  fee_bp: 30,
  type: "constant_product",
  total_trustlines: "1",
  total_shares: "100.0000000",
  reserves: [{ asset: "native", amount: "50.0000000" }],
})
const deposit = {
  poolId: POOL_A,
  maxAmountA: "1",
  maxAmountB: "2",
  minPrice: "0.4",
  maxPrice: "0.6",
}

const harnesses: StellarTestHarness[] = []
function harness(): StellarTestHarness {
  const h = createStellarTestHarness({ network: "testnet" })
  harnesses.push(h)
  return h
}

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  fetchLiquidityPool.mockImplementation(async (_config, { poolId }) => pool(poolId))
})

afterEach(() => {
  for (const h of harnesses.splice(0)) {
    h.dispose()
    h.runtime.queryStore.clear()
  }
})

describe("useLiquidityPool", () => {
  test("fetches static and reactive pool ids through the core query", async () => {
    const h = harness()
    const poolId = ref(POOL_A)
    const state = h.run(() => useLiquidityPool({ poolId }))
    await flush()
    expect(state.pool.value).toEqual(pool(POOL_A))

    poolId.value = POOL_B
    await flush()
    expect(fetchLiquidityPool).toHaveBeenLastCalledWith(h.runtime.networkConfig, { poolId: POOL_B })
    expect(state.pool.value).toEqual(pool(POOL_B))
  })

  test("two identical calls share one request", async () => {
    const pending = deferred<LiquidityPool>()
    fetchLiquidityPool.mockReturnValueOnce(pending.promise)
    const h = harness()
    const first = h.run(() => useLiquidityPool({ poolId: POOL_A }))
    const second = h.run(() => useLiquidityPool({ poolId: POOL_A }))
    expect(fetchLiquidityPool).toHaveBeenCalledTimes(1)

    pending.resolve(pool(POOL_A))
    await flush()
    expect(first.pool.value).toEqual(pool(POOL_A))
    expect(second.pool.value).toEqual(pool(POOL_A))
  })

  test("an empty id fetches nothing", async () => {
    const h = harness()
    const state = h.run(() => useLiquidityPool({ poolId: "  " }))
    await flush()
    expect(fetchLiquidityPool).not.toHaveBeenCalled()
    expect(state.pool.value).toBeNull()
  })

  test("surfaces the core error code", async () => {
    fetchLiquidityPool.mockRejectedValueOnce(new StellarError("ACCOUNT_NOT_FOUND"))
    const h = harness()
    const state = h.run(() => useLiquidityPool({ poolId: POOL_A, maxRetries: 0 }))
    await flush()
    expect(state.error.value?.code).toBe("ACCOUNT_NOT_FOUND")
    expect(state.loading.value).toBe(false)
  })
})

describe("useLiquidityPoolActions", () => {
  const wallet: WalletState = {
    connected: true,
    connecting: false,
    address: "G" + "B".repeat(55),
    network: "testnet",
    wallet: "freighter",
    walletName: "Freighter",
    error: null,
    walletNetwork: "testnet",
    walletNetworkPassphrase: "Test SDF Network ; September 2015",
  }

  test("delegates to the core action with the runtime and projects success", async () => {
    depositLiquidity.mockResolvedValue({ hash: "abc", status: "success" })
    const h = harness()
    h.runtime.setWallet(wallet)
    const state = h.run(useLiquidityPoolActions)

    const promise = state.deposit(deposit)
    expect(state.loading.value).toBe(true)
    await expect(promise).resolves.toEqual({ hash: "abc", status: "success" })
    expect(depositLiquidity).toHaveBeenCalledWith(
      expect.objectContaining({ queryStore: h.runtime.queryStore, wallet }),
      deposit
    )
    expect(state.result.value).toEqual({ hash: "abc", status: "success" })
    expect(state.loading.value).toBe(false)
  })

  test("a rejected submission resolves null, records the failed hash and the error", async () => {
    withdrawLiquidity.mockRejectedValue(
      Object.assign(new StellarError("TRANSACTION_FAILED", undefined, { hash: "dead" }), {
        isSubmissionFailure: true,
      })
    )
    const state = harness().run(useLiquidityPoolActions)
    await expect(
      state.withdraw({ poolId: POOL_A, amount: "1", minAmountA: "0", minAmountB: "0" })
    ).resolves.toBeNull()
    expect(state.result.value).toEqual({ hash: "dead", status: "failed" })
    expect(state.error.value?.code).toBe("TRANSACTION_FAILED")
  })

  test("a stale call cannot overwrite a newer one", async () => {
    const slow = deferred<core.TransactionResult>()
    depositLiquidity
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ hash: "new", status: "success" })
    const state = harness().run(useLiquidityPoolActions)
    const first = state.deposit(deposit)
    await state.deposit(deposit)
    slow.resolve({ hash: "old", status: "success" })
    await first
    expect(state.result.value).toEqual({ hash: "new", status: "success" })
  })
})
