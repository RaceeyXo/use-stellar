import { createStellarTestHarness } from "../test-utils"
import { useBalance } from "../useBalance"
import { nextTick } from "vue"

// useBalance fetches through core's `fetchAccount`, so the boundary to replace
// is the SDK's Horizon client — everything between it and the projection
// (balance parsing, error normalization, caching) runs for real.
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk")
  return { ...actual, Horizon: { ...actual.Horizon, Server: jest.fn() } }
})

import { Horizon } from "@stellar/stellar-sdk"
import { toStellarError } from "use-stellar/core"

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
    expect(toStellarError(contracts.walletRejection.response)?.code).toBe(
      contracts.walletRejection.expectedErrorCode
    )
  })
})
