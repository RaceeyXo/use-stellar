import { createSSRApp, defineComponent, h } from "vue"
import { renderToString } from "@vue/server-renderer"
import * as core from "use-stellar/core"
import { useQuery } from "../internal/useQuery"
import { createStellarPlugin, useStellarRuntime, type StellarRuntime } from "../plugin"
import { useBalance } from "../useBalance"
import { useClaimableBalance } from "../useClaimableBalance"
import { usePaymentHistory } from "../usePaymentHistory"
import { usePayments } from "../usePayments"
import { useLiquidityPool, useLiquidityPoolActions } from "../useLiquidityPool"
import { useSorobanWrite } from "../useSorobanWrite"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  fetchAccount: jest.fn(),
  fetchClaimableBalances: jest.fn(),
  fetchPaymentsPage: jest.fn(),
  fetchLiquidityPool: jest.fn(),
  invokeContract: jest.fn(),
}))

const ADDRESS = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const fetchAccount = core.fetchAccount as jest.MockedFunction<typeof core.fetchAccount>
const fetchClaimableBalances = core.fetchClaimableBalances as jest.MockedFunction<
  typeof core.fetchClaimableBalances
>
const fetchPaymentsPage = core.fetchPaymentsPage as jest.MockedFunction<
  typeof core.fetchPaymentsPage
>
const fetchLiquidityPool = core.fetchLiquidityPool as jest.MockedFunction<
  typeof core.fetchLiquidityPool
>
const invokeContract = core.invokeContract as jest.MockedFunction<typeof core.invokeContract>
const POOL_ID = "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7"

function allComposablesComponent() {
  return defineComponent({
    setup() {
      const balance = useBalance({ address: ADDRESS })
      const claimable = useClaimableBalance({ address: ADDRESS })
      const payments = usePayments({ address: ADDRESS })
      const history = usePaymentHistory({ address: ADDRESS, direction: "incoming" })
      const pool = useLiquidityPool({ poolId: POOL_ID })
      const poolActions = useLiquidityPoolActions()
      const write = useSorobanWrite()
      return () =>
        h("main", [
          h("span", pool.pool.value ? "pool" : "no-pool"),
          h("span", poolActions.loading.value || write.loading.value ? "busy" : "ready"),
          h("span", balance.loading.value ? "loading" : "idle"),
          h("span", String(claimable.balances.value.length)),
          h("span", String(payments.payments.value.length)),
          h("span", String(history.payments.value.length)),
        ])
    },
  })
}

test("every exported composable renders without browser globals or server requests", async () => {
  expect(typeof window).toBe("undefined")
  expect(typeof localStorage).toBe("undefined")

  const app = createSSRApp(allComposablesComponent())
  app.use(createStellarPlugin())
  const html = await renderToString(app)

  expect(html).toContain("idle")
  expect(fetchAccount).not.toHaveBeenCalled()
  expect(fetchClaimableBalances).not.toHaveBeenCalled()
  expect(fetchPaymentsPage).not.toHaveBeenCalled()
  expect(fetchLiquidityPool).not.toHaveBeenCalled()
  expect(invokeContract).not.toHaveBeenCalled()
  expect(html).toContain("no-pool")
})

test("plugin installation creates one isolated runtime per SSR request", async () => {
  const runtimes: StellarRuntime[] = []
  const Request = defineComponent({
    setup() {
      runtimes.push(useStellarRuntime())
      return () => h("div", "request")
    },
  })

  const first = createSSRApp(Request).use(createStellarPlugin())
  const second = createSSRApp(Request).use(createStellarPlugin())
  await Promise.all([renderToString(first), renderToString(second)])

  expect(runtimes).toHaveLength(2)
  expect(runtimes[0]).not.toBe(runtimes[1])
  expect(runtimes[0]?.queryStore).not.toBe(runtimes[1]?.queryStore)
})

test("the internal query adapter supports an explicit SSR opt-in", async () => {
  const queryFn = jest.fn(async () => "server-result")
  const OptIn = defineComponent({
    setup() {
      const runtime = useStellarRuntime()
      useQuery({
        queryKey: () => ["ssr", "opt-in"],
        queryFn,
        store: runtime.queryStore,
        ssr: true,
      })
      return () => h("div", "opted-in")
    },
  })
  const app = createSSRApp(OptIn).use(createStellarPlugin())
  await renderToString(app)
  await Promise.resolve()
  expect(queryFn).toHaveBeenCalledTimes(1)
})
