import { mockHorizonServer, TESTNET_ADDRESS_B } from "@stellar/stellar-sdk"
import type { StellarError } from "use-stellar"
import {
  act,
  getAppState,
  renderHookWithStellar,
  setAppState,
  setOnline,
  waitFor,
} from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// `useLiquidityPool` is not exported from either package entry point yet, so it
// is loaded from its source file. Loading it at runtime (rather than importing
// it) keeps core's sources out of this package's type-check program. It
// resolves the same core modules, and so the same native StellarProvider
// context, as the public hooks do.
interface LiquidityPool {
  id: string
  fee_bp: number
  type: string
  total_trustlines: string
  total_shares: string
  reserves: { asset: string; amount: string }[]
}

const { useLiquidityPool } = jest.requireActual("../../../core/src/hooks/useLiquidityPool") as {
  useLiquidityPool: (poolId: string) => {
    pool: LiquidityPool | null
    loading: boolean
    error: StellarError | null
    refetch: () => Promise<void>
  }
}

const POOL_ID = "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7"

// Testnet-only: the USDC issuer is a throwaway testnet account.
const POOL = {
  id: POOL_ID,
  fee_bp: 30,
  type: "constant_product",
  total_trustlines: "12",
  total_shares: "5000.0000000",
  reserves: [
    { asset: "native", amount: "1000.0000000" },
    { asset: `USDC:${TESTNET_ADDRESS_B}`, amount: "250.0000000" },
  ],
}

type MockHorizonWithPools = typeof mockHorizonServer & { liquidityPools?: jest.Mock }

describe("useLiquidityPool on React Native", () => {
  let call: jest.Mock
  let liquidityPoolId: jest.Mock
  const server = mockHorizonServer as MockHorizonWithPools

  beforeEach(() => {
    mockHorizonServer.reset()
    call = jest.fn().mockResolvedValue({ ...POOL, extra_field: "ignored" })
    liquidityPoolId = jest.fn(() => ({ call }))
    // The shared Horizon mock predates the liquidity pool endpoint.
    server.liquidityPools = jest.fn(() => ({ liquidityPoolId }))
  })

  afterEach(() => {
    delete server.liquidityPools
  })

  describe("initial load", () => {
    it("loads the pool and maps only the documented fields without any DOM global", async () => {
      assertNoDomGlobals()
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.pool).not.toBeNull()
      })

      expect(result.current.pool).toEqual(POOL)
      expect(result.current.error).toBeNull()
      expect(liquidityPoolId).toHaveBeenCalledWith(POOL_ID)
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("makes no request without a pool id", async () => {
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(""))

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.pool).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(server.liquidityPools).not.toHaveBeenCalled()
      unmount()
    })
  })

  describe("foreground", () => {
    it("keeps its pool across a background/foreground round trip without extra requests", async () => {
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))
      await waitFor(() => expect(result.current.pool).not.toBeNull())

      act(() => {
        setAppState("background")
      })
      expect(getAppState()).toBe("background")
      act(() => {
        jest.advanceTimersByTime(60_000)
      })
      act(() => {
        setAppState("active")
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.pool).toEqual(POOL)
      expect(result.current.error).toBeNull()
      expect(call).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("shows the updated pool when refetched after returning to the foreground", async () => {
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))
      await waitFor(() => expect(result.current.pool).not.toBeNull())

      act(() => {
        setAppState("background")
      })
      call.mockResolvedValue({ ...POOL, total_shares: "5100.0000000" })
      act(() => {
        setAppState("active")
      })
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.pool?.total_shares).toBe("5100.0000000")
      expect(call).toHaveBeenCalledTimes(2)
      unmount()
    })
  })

  describe("offline", () => {
    it("surfaces a NETWORK_ERROR, keeps the last pool, and recovers once back online", async () => {
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))
      await waitFor(() => expect(result.current.pool).not.toBeNull())

      act(() => {
        setOnline(false)
      })
      call.mockRejectedValue(new Error("Network Error"))
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.error?.code).toBe("NETWORK_ERROR")
      expect(result.current.pool).toEqual(POOL)
      expect(result.current.loading).toBe(false)

      act(() => {
        setOnline(true)
      })
      call.mockResolvedValue({ ...POOL, total_trustlines: "13" })
      await act(async () => {
        await result.current.refetch()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.pool?.total_trustlines).toBe("13")
      unmount()
    })
  })

  describe("error codes", () => {
    it("maps an unknown pool (404) to ACCOUNT_NOT_FOUND", async () => {
      call.mockRejectedValue({ response: { status: 404, data: {} } })
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))

      await waitFor(() => expect(result.current.error).not.toBeNull())

      expect(result.current.error?.code).toBe("ACCOUNT_NOT_FOUND")
      expect(result.current.pool).toBeNull()
      expect(result.current.loading).toBe(false)
      unmount()
    })

    it("maps a rate limit (429) to RATE_LIMITED", async () => {
      call.mockRejectedValue({ response: { status: 429, data: {} } })
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))

      await waitFor(() => expect(result.current.error?.code).toBe("RATE_LIMITED"))
      unmount()
    })

    it("maps a gateway failure (503) to NETWORK_ERROR", async () => {
      call.mockRejectedValue({ response: { status: 503, data: {} } })
      const { result, unmount } = renderHookWithStellar(() => useLiquidityPool(POOL_ID))

      await waitFor(() => expect(result.current.error?.code).toBe("NETWORK_ERROR"))
      unmount()
    })
  })
})
