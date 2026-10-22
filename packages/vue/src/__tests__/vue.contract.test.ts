import { createStellarTestHarness } from "../test-utils"
import { useBalance } from "../useBalance"
import { nextTick } from "vue"

jest.mock("../horizon", () => {
  const actual = jest.requireActual("../horizon")
  return { ...actual, getHorizonServer: jest.fn() }
})

import { getHorizonServer, normalizeAdapterError } from "../horizon"

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
const mockGetHorizonServer = jest.mocked(getHorizonServer)

function horizonError(status: number, problemType: string): Error {
  return Object.assign(new Error(`Horizon returned ${status}`), {
    response: { status, data: { status, type: problemType } },
  })
}

describe("Vue balance adapter contract", () => {
  beforeEach(() => {
    loadAccount.mockReset()
    mockGetHorizonServer.mockReturnValue({ loadAccount } as never)
  })

  test.each(contracts.balance)("$name", async contract => {
    if (contract.response.kind === "success") {
      loadAccount.mockResolvedValue(contract.response.account)
    } else if (contract.response.kind === "error") {
      loadAccount.mockRejectedValue(
        horizonError(contract.response.status, contract.response.problemType)
      )
    }

    const harness = createStellarTestHarness({ network: "testnet", queryConfig: { gcTime: 0 } })
    const result = harness.run(() => useBalance({ address: contract.input.address }))
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
          harness.runtime.queryStore.subscriberCount(JSON.stringify(contract.expected.cacheKey))
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
