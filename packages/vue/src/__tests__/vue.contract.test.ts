/**
 * @jest-environment jsdom
 */
import { createStellarTestHarness } from "../test-utils"
import { useBalance } from "../useBalance"
import { nextTick } from "vue"

// useBalance fetches through core's `fetchAccount`, so the boundary to replace
// is the SDK's Horizon client — everything between it and the projection
// (balance parsing, error normalization, caching) runs for real.
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk")
  return {
    ...actual,
    Horizon: { ...actual.Horizon, Server: jest.fn() },
    rpc: { ...actual.rpc, Server: jest.fn() },
    // The read path (`simulateContractCall`) still uses the older `SorobanRpc` export.
    SorobanRpc: { ...actual.SorobanRpc, Server: jest.fn() },
  }
})

// The React hooks read their context from StellarProvider; the parity suite hands
// them the same runtime values the Vue harness has, with a connected wallet.
const mockReactContext: { current: unknown } = { current: null }
jest.mock("../../../core/src/context/StellarProvider", () => ({
  useStellarContext: () => mockReactContext.current,
}))

import { Horizon, rpc, SorobanDataBuilder, SorobanRpc, xdr } from "@stellar/stellar-sdk"
import {
  NETWORK_CONFIGS,
  QueryStore,
  registerWalletAdapter,
  type WalletState,
} from "use-stellar/core"
import * as vueExports from "../index"
import {
  ACCOUNT_RECORD,
  PARITY_TABLE,
  PARITY_WALLET_ADDRESS,
  VUE_ONLY,
  missingParityRows,
  type AnyFn,
  type MockResponses,
  type ParityRow,
  type ParitySnapshot,
} from "./parity.table"
import { normalizeAdapterError } from "../horizon"

interface ContractFile {
  balance: BalanceContract[]
  walletRejection: {
    response: { name: string; code: string; message: string }
    expectedErrorCode: string
  }
}

interface BalanceContract {
  name: string
  input: { address: string | null }
  response:
    | { kind: "idle" }
    | {
        kind: "success"
        account: {
          id: string
          balances: { asset_type: string; balance: string }[]
        }
      }
    | { kind: "error"; status: number; problemType: string }
  expected: {
    balance: string | null
    balancesLength: number
    loading: boolean
    errorCode: string | null
    cacheKey: unknown[] | null
  }
}

// Load the same framework-free bytes as React without widening Vue's build root.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const contracts = require("../../../core/src/__tests__/contracts/contracts.json") as ContractFile
const loadAccount = jest.fn()
const MockHorizonServer = Horizon.Server as unknown as jest.Mock

/** The fixture account, shaped like the SDK's AccountResponse that core reads. */
function accountResponse(account: { id: string; balances: unknown[] }) {
  return {
    ...account,
    sequenceNumber: () => "1",
    subentry_count: 0,
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    signers: [],
  }
}

function horizonError(status: number, problemType: string): Error {
  return Object.assign(new Error(`Horizon returned ${status}`), {
    response: { status, data: { status, type: problemType } },
  })
}

describe("Vue balance adapter contract", () => {
  beforeEach(() => {
    loadAccount.mockReset()
    MockHorizonServer.mockImplementation(() => ({ loadAccount }))
  })

  test.each(contracts.balance)("$name", async contract => {
    if (contract.response.kind === "success") {
      loadAccount.mockResolvedValue(accountResponse(contract.response.account))
    } else if (contract.response.kind === "error") {
      loadAccount.mockRejectedValue(
        horizonError(contract.response.status, contract.response.problemType)
      )
    }

    const harness = createStellarTestHarness({ network: "testnet", queryConfig: { gcTime: 0 } })
    // No retries, as in the React contract test: a 429 settles straight away.
    const result = harness.run(() => useBalance({ address: contract.input.address, maxRetries: 0 }))
    try {
      const expectedProjection = {
        balance: contract.expected.balance,
        balancesLength: contract.expected.balancesLength,
        loading: contract.expected.loading,
        errorCode: contract.expected.errorCode,
      }
      const projection = () => ({
        balance: result.balance.value,
        balancesLength: result.balances.value.length,
        loading: result.loading.value,
        errorCode:
          result.error.value &&
          typeof result.error.value === "object" &&
          "code" in result.error.value
            ? (result.error.value as { code: string }).code
            : null,
      })

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await Promise.resolve()
        await nextTick()
        if (JSON.stringify(projection()) === JSON.stringify(expectedProjection)) break
      }
      expect(projection()).toEqual(expectedProjection)

      if (contract.expected.cacheKey) {
        expect(
          harness.runtime.queryStore.getSnapshot(contract.expected.cacheKey)?.subscribers
        ).toBe(1)
      } else {
        expect(loadAccount).not.toHaveBeenCalled()
      }
    } finally {
      harness.dispose()
      harness.runtime.queryStore.clear()
    }
  })

  test("projects wallet rejection with the shared error code", () => {
    expect(normalizeAdapterError(contracts.walletRejection.response).code).toBe(
      contracts.walletRejection.expectedErrorCode
    )
  })
})

// ── React / Vue parity (#502) ──────────────────────────────────────────────

// React and Testing Library come from the core package, which owns them: loaded at
// run time so Vue's build root and dependencies stay React-free.
/* eslint-disable @typescript-eslint/no-require-imports */
const { renderHook, act } = require("../../../core/node_modules/@testing-library/react") as {
  renderHook: AnyFn
  act: AnyFn
}
const reactHook = (name: string): AnyFn =>
  (require(`../../../core/src/hooks/${name}`) as Record<string, AnyFn>)[name]
/* eslint-enable @typescript-eslint/no-require-imports */

const MockRpcServer = rpc.Server as unknown as jest.Mock
const MockLegacyRpcServer = SorobanRpc.Server as unknown as jest.Mock
const PARITY_WALLET = "parity-wallet"
const SCENARIOS = [
  { name: "success", status: null },
  { name: "404", status: 404, problem: "not_found" },
  { name: "429", status: 429, problem: "rate_limit_exceeded" },
  { name: "500", status: 500, problem: "server_error" },
] as const
type Scenario = (typeof SCENARIOS)[number]

/** Every request either framework made, as `method(args)` or a Horizon call chain. */
let requests: string[] = []
let active: { scenario: Scenario; responses: MockResponses } = {
  scenario: SCENARIOS[0],
  responses: {},
}

const fmt = (args: unknown[]): string =>
  args
    .map(arg =>
      arg && typeof arg === "object"
        ? "toXDR" in (arg as object)
          ? "<tx>"
          : JSON.stringify(arg)
        : JSON.stringify(arg)
    )
    .join(",")

function successValue(method: string): unknown {
  const value = active.responses[method]
  if (method === "loadAccount") {
    // The SDK's own AccountResponse: the balance mapping reads its fields, and
    // TransactionBuilder uses its sequence methods.
    return new Horizon.AccountResponse(
      ACCOUNT_RECORD as unknown as ConstructorParameters<typeof Horizon.AccountResponse>[0]
    )
  }
  if (value === "SIMULATION_SUCCESS") {
    return {
      id: "sim",
      latestLedger: 100,
      events: [],
      _parsed: true,
      transactionData: new SorobanDataBuilder(),
      minResourceFee: "100",
      result: { auth: [], retval: xdr.ScVal.scvU32(7) },
    }
  }
  if (value === "TRANSACTION_SUCCESS") {
    return {
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      latestLedger: 101,
      returnValue: xdr.ScVal.scvU32(7),
    }
  }
  return value
}

function respond(method: string): Promise<unknown> {
  const { scenario } = active
  if (scenario.status !== null) {
    return Promise.reject(
      Object.assign(new Error(`HTTP ${scenario.status}`), {
        response: {
          status: scenario.status,
          data: {
            status: scenario.status,
            type: `https://stellar.org/horizon-errors/${scenario.problem}`,
            title: scenario.problem,
          },
        },
      })
    )
  }
  if (!(method in active.responses) && method !== "loadAccount") {
    return Promise.reject(new Error(`No mock response for ${method}`))
  }
  return Promise.resolve(successValue(method))
}

/** A Horizon server double: direct methods respond; call-builder chains respond on `.call()`. */
function fakeHorizonServer(): object {
  const chain = (root: string, segments: string[]): object =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "then" || typeof prop === "symbol") return undefined
          return (...args: unknown[]) => {
            if (prop === "call") {
              requests.push([...segments, "call()"].join("."))
              return respond(root)
            }
            return chain(root, [...segments, `${prop}(${fmt(args)})`])
          }
        },
      }
    )
  const direct = new Set(["loadAccount", "fetchBaseFee", "submitTransaction", "feeStats"])
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "then" || typeof prop === "symbol") return undefined
        return (...args: unknown[]) => {
          if (direct.has(prop)) {
            requests.push(`${prop}(${fmt(args)})`)
            return respond(prop)
          }
          return chain(prop, [`${prop}(${fmt(args)})`])
        }
      },
    }
  )
}

/** A Soroban RPC server double: every method is a recorded request. */
function fakeRpcServer(): object {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "then" || typeof prop === "symbol") return undefined
        return (...args: unknown[]) => {
          requests.push(`rpc.${prop}(${fmt(args)})`)
          return respond(prop)
        }
      },
    }
  )
}

function connectedWallet(): WalletState {
  return {
    connected: true,
    connecting: false,
    address: PARITY_WALLET_ADDRESS,
    network: "testnet",
    wallet: PARITY_WALLET,
    walletName: "Parity",
    error: null,
    walletNetwork: "testnet",
    walletNetworkPassphrase: NETWORK_CONFIGS.testnet.networkPassphrase,
  }
}

interface Observation {
  requests: string[]
  keyCached: boolean | null
  data: unknown
  errorCode: string | null
  loading: boolean
}

const errorCode = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error
    ? String((error as { code: unknown }).code)
    : null

/** Plain JSON, so React's and Vue's values compare by content rather than by proxy or class. */
const plain = (value: unknown): unknown =>
  value === undefined
    ? null
    : JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? String(v) : v)))

async function settle(read: () => ParitySnapshot, expectRun: boolean): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 0))
    const snapshot = read()
    // Settled: a request went out, and the state stopped loading.
    if (
      requests.length > 0 &&
      !snapshot.loading &&
      (expectRun || snapshot.data !== null || snapshot.error !== null)
    )
      return
  }
}

async function observeReact(row: ParityRow): Promise<Observation> {
  requests = []
  const store = new QueryStore({ gcTime: 0 })
  mockReactContext.current = {
    network: "testnet",
    networkConfig: NETWORK_CONFIGS.testnet,
    wallet: connectedWallet(),
    setWallet: () => undefined,
    autoConnect: { enabled: false, storage: "local" },
    queryStore: store,
    platform: { isBrowser: true, isReactNative: false, isServer: false },
    transactionTimeout: 30,
  }
  const hook = reactHook(row.react)
  const { result, unmount } = renderHook(() => row.callReact(hook, row.args))
  if (result.current.run) {
    await act(async () => {
      await result.current.run().catch(() => undefined)
    })
  }
  await act(async () => settle(() => result.current, Boolean(result.current.run)))
  const snapshot = result.current as ParitySnapshot
  const observation: Observation = {
    requests,
    keyCached: row.queryKey
      ? store.getSnapshot(row.queryKey(NETWORK_CONFIGS.testnet)) !== undefined
      : null,
    data: plain(snapshot.data),
    errorCode: errorCode(snapshot.error),
    loading: snapshot.loading,
  }
  unmount()
  store.clear()
  return observation
}

async function observeVue(row: ParityRow): Promise<Observation> {
  requests = []
  const harness = createStellarTestHarness({ network: "testnet", queryConfig: { gcTime: 0 } })
  harness.runtime.setWallet(connectedWallet())
  try {
    const composable = (vueExports as unknown as Record<string, AnyFn>)[row.vue]
    const probe = harness.run(() => row.callVue(composable, row.args))
    if (probe.run) await probe.run().catch(() => undefined)
    await settle(probe.read, Boolean(probe.run))
    const snapshot = probe.read()
    return {
      requests,
      keyCached: row.queryKey
        ? harness.runtime.queryStore.getSnapshot(row.queryKey(harness.runtime.networkConfig)) !==
          undefined
        : null,
      data: plain(snapshot.data),
      errorCode: errorCode(snapshot.error),
      loading: snapshot.loading,
    }
  } finally {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
}

describe("React and Vue parity for every composable pair (#502)", () => {
  beforeAll(() => {
    registerWalletAdapter(
      {
        metadata: { type: PARITY_WALLET, name: "Parity", supported: true },
        isAvailable: async () => true,
        connect: async () => ({ address: PARITY_WALLET_ADDRESS }),
        getNetworkDetails: async () => ({
          network: "testnet",
          networkPassphrase: NETWORK_CONFIGS.testnet.networkPassphrase,
        }),
        // The unsigned envelope is a valid envelope: the fake server never checks signatures.
        signTransaction: async (envelope: string) => envelope,
      } as never,
      { override: true } as never
    )
  })

  beforeEach(() => {
    MockHorizonServer.mockImplementation(() => fakeHorizonServer())
    MockRpcServer.mockImplementation(() => fakeRpcServer())
    MockLegacyRpcServer.mockImplementation(() => fakeRpcServer())
  })

  test("every exported Vue composable has a parity row", () => {
    expect(missingParityRows(vueExports as unknown as Record<string, unknown>)).toEqual([])
  })

  test("a composable exported without a row fails the check", () => {
    const exportsWithNewComposable = { ...vueExports, useBrandNewThing: () => null }
    expect(missingParityRows(exportsWithNewComposable)).toEqual(["useBrandNewThing"])
  })

  test("exemptions name real exports", () => {
    for (const name of Object.keys(VUE_ONLY)) expect(vueExports).toHaveProperty(name)
  })

  describe.each(PARITY_TABLE.map(row => [`${row.vue} ↔ React ${row.react}`, row] as const))(
    "%s",
    (_label, row) => {
      test.each(SCENARIOS.map(scenario => [scenario.name, scenario] as const))(
        "%s: same requests, query key, data and error code",
        async (_name, scenario) => {
          active = { scenario, responses: row.mockResponses }
          const react = await observeReact(row)
          const vue = await observeVue(row)

          expect(react.requests.length).toBeGreaterThan(0)
          expect(vue).toEqual(react)
          if (scenario.status === null) {
            expect(react.errorCode).toBeNull()
            expect(react.data).not.toBeNull()
          }
          if (row.queryKey) expect(react.keyCached).toBe(true)
        }
      )
    }
  )
})
