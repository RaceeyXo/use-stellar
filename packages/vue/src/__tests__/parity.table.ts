// packages/vue/src/__tests__/parity.table.ts
//
// One row per React/Vue pair. `vue.contract.test.ts` runs every row against the
// same mocked SDK boundary (Horizon and Soroban RPC) in each framework, and
// asserts that both make the same requests, use the same cache key, map the
// same data, and report the same error `code` for 404, 429 and 500.
//
// Every composable `@use-stellar/vue` exports needs a row here (or an entry in
// `VUE_ONLY` with the reason it has no React twin): the contract test fails
// otherwise, so a new composable cannot ship without a parity check.

/** A hook or composable, loosely typed: the table must not widen Vue's build root to core's sources. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFn = (...args: any[]) => any

/** What a row reads back from either framework, already unwrapped from refs. */
export interface ParitySnapshot {
  data: unknown
  error: unknown
  loading: boolean
}

/**
 * Successful SDK responses, keyed by the method that ends a request: a Horizon
 * call-builder chain (`liquidityPools`, `payments`, …, resolved by `.call()`),
 * or a direct server method (`loadAccount`, `simulateTransaction`, …). Error
 * scenarios reject every one of them with the scenario's HTTP status instead.
 */
export type MockResponses = Record<string, unknown>

export interface ParityRow {
  /** The exported Vue composable. */
  vue: string
  /** The React hook it mirrors, as exported from `packages/core/src/hooks/<react>.ts`. */
  react: string
  /** Shared input, mapped onto each framework's signature by `callReact` / `callVue`. */
  args: Record<string, unknown>
  mockResponses: MockResponses
  /** The cache key both frameworks must use, for queries. Actions have none. */
  queryKey?: (network: {
    horizonUrl: string
    sorobanUrl: string
    network: string
  }) => readonly unknown[]
  /** Calls the React hook (inside `renderHook`) and projects its state. */
  callReact: (
    hook: AnyFn,
    args: Record<string, unknown>
  ) => ParitySnapshot & { run?: () => Promise<unknown> }
  /** Calls the Vue composable (inside a harness scope) and returns a projector. */
  callVue: (
    composable: AnyFn,
    args: Record<string, unknown>
  ) => { read: () => ParitySnapshot; run?: () => Promise<unknown> }
}

const ACCOUNT = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const OTHER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const POOL_ID = "dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7"
const CONTRACT_ID = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR"
const USDC = { code: "USDC", issuer: OTHER }

/** The signer every write row uses; the contract test connects it on both sides. */
export const PARITY_WALLET_ADDRESS = ACCOUNT

/** The account record `loadAccount` returns: enough for both the balance mapping and a TransactionBuilder. */
export const ACCOUNT_RECORD = {
  id: ACCOUNT,
  account_id: ACCOUNT,
  sequence: "100",
  subentry_count: 0,
  thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
  signers: [],
  balances: [
    { asset_type: "native", balance: "100.0000000" },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: OTHER,
      balance: "5.0000000",
    },
  ],
}

const SUBMITTED = { successful: true, hash: "parity-hash" }

const unwrap = (value: unknown): unknown =>
  value && typeof value === "object" && "value" in (value as object)
    ? (value as { value: unknown }).value
    : value

/** Projects a Vue return object field by field. */
const vueRead = (state: Record<string, unknown>, dataKey: string) => (): ParitySnapshot => ({
  data: unwrap(state[dataKey]),
  error: unwrap(state.error),
  loading: Boolean(unwrap(state.loading)),
})

/** Rows for the write composables differ only by the action they call. */
function actionRow(
  vue: string,
  react: string,
  method: string,
  args: Record<string, unknown>,
  mockResponses: MockResponses = {}
): ParityRow {
  return {
    vue,
    react,
    args,
    mockResponses: {
      loadAccount: ACCOUNT_RECORD,
      fetchBaseFee: 100,
      submitTransaction: SUBMITTED,
      ...mockResponses,
    },
    callReact: (hook, input) => {
      const state = hook()
      return {
        data: state.result,
        error: state.error,
        loading: state.loading,
        run: () => state[method](input),
      }
    },
    callVue: (composable, input) => {
      const state = composable()
      return { read: vueRead(state, "result"), run: () => state[method](input) }
    },
  }
}

export const PARITY_TABLE: ParityRow[] = [
  {
    vue: "useBalance",
    react: "useBalance",
    args: { address: ACCOUNT, maxRetries: 0 },
    mockResponses: { loadAccount: ACCOUNT_RECORD },
    queryKey: n => ["account", n.horizonUrl, n.network, ACCOUNT],
    callReact: (hook, args) => {
      const state = hook(args)
      return { data: state.balances, error: state.error, loading: state.loading }
    },
    callVue: (composable, args) => ({ read: vueRead(composable(args), "balances") }),
  },
  {
    vue: "useClaimableBalance",
    react: "useClaimableBalance",
    args: { address: ACCOUNT, maxRetries: 0 },
    mockResponses: {
      claimableBalances: {
        records: [
          {
            id: "00000000a1",
            asset: "native",
            amount: "10.0000000",
            sponsor: OTHER,
            claimants: [{ destination: ACCOUNT, predicate: { unconditional: true } }],
          },
        ],
      },
    },
    queryKey: n => ["claimableBalance", n.horizonUrl, n.network, ACCOUNT],
    callReact: (hook, args) => {
      const state = hook(args)
      return { data: state.balances, error: state.error, loading: state.loading }
    },
    callVue: (composable, args) => ({ read: vueRead(composable(args), "balances") }),
  },
  {
    vue: "useLiquidityPool",
    react: "useLiquidityPool",
    args: { poolId: POOL_ID, maxRetries: 0 },
    mockResponses: {
      liquidityPools: {
        id: POOL_ID,
        fee_bp: 30,
        type: "constant_product",
        total_trustlines: "3",
        total_shares: "500.0000000",
        reserves: [
          { asset: "native", amount: "100.0000000" },
          { asset: `USDC:${OTHER}`, amount: "25.0000000" },
        ],
      },
    },
    queryKey: n => ["liquidityPool", n.horizonUrl, n.network, POOL_ID],
    callReact: (hook, args) => {
      const state = hook(args.poolId, { maxRetries: args.maxRetries })
      return { data: state.pool, error: state.error, loading: state.loading }
    },
    callVue: (composable, args) => ({
      read: vueRead(composable(args), "pool"),
    }),
  },
  {
    vue: "usePayments",
    react: "usePayments",
    args: { address: ACCOUNT, limit: 5, order: "desc", maxRetries: 0 },
    mockResponses: {
      payments: {
        records: [
          {
            id: "1",
            paging_token: "1",
            type: "payment",
            created_at: "2026-01-01T00:00:00Z",
            transaction_hash: "aa",
            from: OTHER,
            to: ACCOUNT,
            asset_type: "native",
            amount: "1.0000000",
          },
        ],
      },
    },
    queryKey: n => ["payments", n.horizonUrl, n.network, ACCOUNT, 5, "desc", ""],
    callReact: (hook, args) => {
      const state = hook(args)
      return { data: state.payments, error: state.error, loading: state.loading }
    },
    callVue: (composable, args) => ({ read: vueRead(composable(args), "payments") }),
  },
  {
    vue: "usePaymentHistory",
    react: "usePaymentHistory",
    args: { address: ACCOUNT, limit: 5, order: "desc", maxRetries: 0 },
    mockResponses: {
      payments: {
        records: [
          {
            id: "2",
            paging_token: "2",
            type: "payment",
            created_at: "2026-01-02T00:00:00Z",
            transaction_hash: "bb",
            from: ACCOUNT,
            to: OTHER,
            asset_type: "native",
            amount: "2.0000000",
          },
        ],
      },
    },
    queryKey: n => ["payments", n.horizonUrl, n.network, ACCOUNT, 5, "desc", ""],
    callReact: (hook, args) => {
      const state = hook(args)
      return { data: state.payments, error: state.error, loading: state.loading }
    },
    callVue: (composable, args) => ({ read: vueRead(composable(args), "payments") }),
  },
  {
    vue: "useSorobanContract",
    react: "useSorobanContract",
    args: { contractId: CONTRACT_ID, method: "get_count", args: [], maxRetries: 0 },
    mockResponses: { simulateTransaction: "SIMULATION_SUCCESS" },
    callReact: (hook, args) => {
      const state = hook(args)
      return { data: state.data, error: state.error, loading: state.loading }
    },
    callVue: (composable, args) => ({ read: vueRead(composable(args), "data") }),
  },
  {
    vue: "useContractEvents",
    react: "useContractEvents",
    // A start ledger skips the getLatestLedger lookup; the long interval keeps it to one poll.
    args: { contractIds: [CONTRACT_ID], startLedger: 100, interval: 60_000 },
    mockResponses: { getEvents: { events: [], latestLedger: 101, cursor: "c1" } },
    callReact: (hook, args) => {
      const state = hook(args)
      return {
        data: { events: state.events, latestLedger: state.latestLedger },
        error: state.error,
        loading: state.loading,
      }
    },
    callVue: (composable, args) => {
      const state = composable(args)
      return {
        read: () => ({
          data: { events: state.events.value, latestLedger: state.latestLedger.value },
          error: state.error.value,
          loading: state.loading.value,
        }),
      }
    },
  },
  actionRow("useSendPayment", "useSendPayment", "send", { to: OTHER, asset: "XLM", amount: "1" }),
  actionRow("useAddTrustline", "useAddTrustline", "addTrustline", { asset: USDC }),
  actionRow("usePathPayment", "usePathPayment", "pathPayment", {
    mode: "strictSend",
    destination: OTHER,
    sendAsset: "XLM",
    sendAmount: "10",
    destAsset: USDC,
    destMin: "2",
    path: [],
  }),
  actionRow("useLiquidityPoolActions", "useLiquidityPoolActions", "deposit", {
    poolId: POOL_ID,
    maxAmountA: "10",
    maxAmountB: "2",
    minPrice: "0.1",
    maxPrice: "0.3",
  }),
  {
    ...actionRow("useSorobanWrite", "useSorobanWrite", "invoke", {
      contractId: CONTRACT_ID,
      method: "increment",
      args: [],
    }),
    mockResponses: {
      loadAccount: ACCOUNT_RECORD,
      simulateTransaction: "SIMULATION_SUCCESS",
      sendTransaction: { status: "PENDING", hash: "parity-hash" },
      getTransaction: "TRANSACTION_SUCCESS",
    },
    // React keeps `{ hash, result }`; Vue adds the outcome `status`. Compare the shared fields.
    callVue: (composable, input) => {
      const state = composable()
      const read = vueRead(state, "result")
      return {
        read: () => {
          const snapshot = read()
          const data = snapshot.data as { hash: string; result: unknown } | null
          return { ...snapshot, data: data && { hash: data.hash, result: data.result } }
        },
        run: () => state.invoke(input),
      }
    },
  },
]

/**
 * Exported composables with no React twin, and why. A name here is exempt from
 * the parity table; anything else exported without a row fails the test.
 */
export const VUE_ONLY: Record<string, string> = {
  useStellarRuntime:
    "Vue's injection accessor for the plugin runtime; React reads context through StellarProvider.",
}

/** The `use*` composables `packageExports` lists that have neither a table row nor a `VUE_ONLY` entry. */
export function missingParityRows(
  packageExports: Record<string, unknown>,
  table: readonly ParityRow[] = PARITY_TABLE,
  exempt: Record<string, string> = VUE_ONLY
): string[] {
  const covered = new Set(table.map(row => row.vue))
  return Object.keys(packageExports)
    .filter(name => /^use[A-Z]/.test(name) && typeof packageExports[name] === "function")
    .filter(name => !covered.has(name) && !(name in exempt))
    .sort()
}
