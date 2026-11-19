import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { StellarProvider, useStellarContext } from "../../context/StellarProvider"
import { toStellarError } from "../../errors"
import { useBalance } from "../../hooks/useBalance"
import type { QueryStore } from "../../cache"

jest.mock("../../utils", () => {
  const actual = jest.requireActual("../../utils")
  return { ...actual, getHorizonServer: jest.fn() }
})

import { getHorizonServer } from "../../utils"

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
          sequence: string
          subentryCount: number
          thresholds: { low: number; medium: number; high: number }
          signers: { key: string; weight: number; type: string }[]
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

// JSON keeps the contract framework-free and directly reusable by native runners.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const contracts = require("./contracts.json") as ContractFile
const loadAccount = jest.fn()
const mockGetHorizonServer = jest.mocked(getHorizonServer)

function horizonError(status: number, problemType: string): Error {
  return Object.assign(new Error(`Horizon returned ${status}`), {
    response: { status, data: { status, type: problemType } },
  })
}

function arrange(contract: BalanceContract): void {
  if (contract.response.kind === "success") {
    const { account } = contract.response
    loadAccount.mockResolvedValue({
      id: account.id,
      sequenceNumber: () => account.sequence,
      subentry_count: account.subentryCount,
      thresholds: {
        low_threshold: account.thresholds.low,
        med_threshold: account.thresholds.medium,
        high_threshold: account.thresholds.high,
      },
      signers: account.signers,
      balances: account.balances,
    })
  } else if (contract.response.kind === "error") {
    loadAccount.mockRejectedValue(
      horizonError(contract.response.status, contract.response.problemType)
    )
  }
}

describe("React balance adapter contract", () => {
  beforeEach(() => {
    loadAccount.mockReset()
    mockGetHorizonServer.mockReturnValue({ loadAccount } as never)
  })

  test.each(contracts.balance)("$name", async contract => {
    arrange(contract)
    let store: QueryStore | undefined

    function Capture({ children }: { children: React.ReactNode }) {
      store = useStellarContext().queryStore
      return children
    }
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <StellarProvider network="testnet" queryConfig={{ gcTime: 0 }}>
          <Capture>{children}</Capture>
        </StellarProvider>
      )
    }

    const { result, unmount } = renderHook(
      () => useBalance({ address: contract.input.address, maxRetries: 0 }),
      { wrapper: Wrapper }
    )

    if (contract.response.kind !== "idle") {
      await waitFor(() => expect(result.current.loading).toBe(false))
    }

    expect({
      balance: result.current.balance,
      balancesLength: result.current.balances.length,
      loading: result.current.loading,
      errorCode: result.current.error?.code ?? null,
    }).toEqual({
      balance: contract.expected.balance,
      balancesLength: contract.expected.balancesLength,
      loading: contract.expected.loading,
      errorCode: contract.expected.errorCode,
    })

    if (contract.expected.cacheKey) {
      expect(store?.getSnapshot(contract.expected.cacheKey)).toBeDefined()
    } else {
      expect(loadAccount).not.toHaveBeenCalled()
    }
    unmount()
    store?.clear()
  })

  test("projects wallet rejection with the shared error code", () => {
    expect(toStellarError(contracts.walletRejection.response)?.code).toBe(
      contracts.walletRejection.expectedErrorCode
    )
  })
})
