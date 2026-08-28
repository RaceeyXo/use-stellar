/**
 * Tests for useSorobanContract — Soroban RPC simulation.
 *
 * The whole SDK is mocked (jest maps "@stellar/stellar-sdk" to a local mock,
 * so the real package cannot be loaded here). The mock models just enough of
 * ScVal to prove what the hook does with its arguments: which values it passes
 * through, which it refuses, and which account it simulates as.
 */

import { renderHook, waitFor } from "@testing-library/react"

// ── Shared mock state ─────────────────────────────────────────────────────────
let mockSimResult: unknown = null
let mockSimError: Error | null = null
let lastSimulatedSource: string | null = null
let lastCallArgs: unknown[] = []
let mockWalletAddress: string | null = null

jest.mock("../context/StellarProvider", () => ({
  useStellarContext: () => ({
    networkConfig: {
      network: "testnet",
      sorobanUrl: "https://soroban-testnet.stellar.org",
      horizonUrl: "https://horizon-testnet.stellar.org",
    },
    wallet: { address: mockWalletAddress },
  }),
}))

jest.mock("@stellar/stellar-sdk", () => {
  /** A stand-in for xdr.ScVal that records the XDR type it represents. */
  class MockScVal {
    constructor(
      public readonly type: string,
      public readonly value: unknown
    ) {}

    toXDR() {
      return `${this.type}:${String(this.value)}`
    }

    switch() {
      return { name: this.type }
    }
  }

  const mockXdr = {
    ScVal: Object.assign(MockScVal, {
      scvBool: (value: boolean) => new MockScVal("scvBool", value),
      scvString: (value: string) => new MockScVal("scvString", value),
      scvSymbol: (value: string) => new MockScVal("scvSymbol", value),
      scvU32: (value: number) => new MockScVal("scvU32", value),
      scvI128: (value: bigint) => new MockScVal("scvI128", value),
      scvAddress: (value: string) => new MockScVal("scvAddress", value),
    }),
  }

  class MockContract {
    constructor(public readonly contractId: string) {}

    call(method: string, ...args: unknown[]) {
      lastCallArgs = args
      return { method, args }
    }
  }

  class MockAccount {
    constructor(
      public readonly accountId: string,
      public readonly sequence: string
    ) {}
  }

  class MockTransactionBuilder {
    private source: string

    constructor(account: MockAccount) {
      this.source = account.accountId
    }

    addOperation() {
      return this
    }

    setTimeout() {
      return this
    }

    build() {
      return { source: this.source }
    }
  }

  class MockServer {
    async simulateTransaction(tx: { source: string }) {
      lastSimulatedSource = tx.source
      if (mockSimError) throw mockSimError
      return mockSimResult
    }
  }

  return {
    xdr: mockXdr,
    Contract: MockContract,
    Account: MockAccount,
    TransactionBuilder: MockTransactionBuilder,
    BASE_FEE: "100",
    Networks: {
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    },
    scValToNative: (value: { value: unknown }) => value.value,
    SorobanRpc: {
      Server: MockServer,
      Api: {
        isSimulationError: (r: unknown) =>
          typeof r === "object" && r !== null && "error" in r && !("result" in r),
        isSimulationSuccess: (r: unknown) => typeof r === "object" && r !== null && "result" in r,
      },
    },
  }
})

// Import AFTER the mock is set up.
import { xdr } from "@stellar/stellar-sdk"
import { useSorobanContract, ANONYMOUS_SIMULATION_SOURCE } from "./useSorobanContract"
import type { ContractSpecLike } from "../types"

/**
 * The runtime `xdr` here is the mock above, but TypeScript still resolves the
 * real SDK's declarations. This alias lets the tests build the mock's simple
 * ScVal shapes without fighting the real constructors' signatures.
 */
const scv = xdr.ScVal as unknown as {
  scvBool: (value: boolean) => unknown
  scvString: (value: string) => unknown
  scvSymbol: (value: string) => unknown
  scvU32: (value: number) => unknown
  scvI128: (value: bigint) => unknown
  scvAddress: (value: string) => unknown
}

const VALID_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"
/** Testnet-only address. */
const TEST_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

beforeEach(() => {
  mockSimResult = null
  mockSimError = null
  lastSimulatedSource = null
  lastCallArgs = []
  mockWalletAddress = null
})

function succeedWith(value: unknown) {
  mockSimResult = {
    result: { retval: scv.scvBool(value as boolean) },
    cost: {},
    latestLedger: 1,
  }
}

// ── Success ───────────────────────────────────────────────────────────────────

describe("useSorobanContract — success", () => {
  it("returns decoded data on successful simulation", async () => {
    succeedWith(true)

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "get_value" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe(true)
  })

  it("sets data to null when simulation returns no retval", async () => {
    mockSimResult = { result: { retval: undefined }, cost: {}, latestLedger: 1 }

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "noop" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

// ── Typed return ──────────────────────────────────────────────────────────────

describe("useSorobanContract — typed return", () => {
  it("returns the declared type with no cast at the call site", async () => {
    mockSimResult = {
      result: { retval: scv.scvI128(BigInt(250)) },
      cost: {},
      latestLedger: 1,
    }

    const { result } = renderHook(() =>
      useSorobanContract<bigint>({
        contractId: VALID_CONTRACT_ID,
        method: "balance",
        args: [scv.scvAddress(TEST_ADDRESS)],
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    // Typed `bigint | null` — this assignment is the test.
    const balance: bigint | null = result.current.data
    expect(balance).toBe(BigInt(250))
  })

  it("keeps existing untyped callers compiling unchanged", async () => {
    succeedWith(false)

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "paused" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    const data: unknown = result.current.data
    expect(data).toBe(false)
  })
})

// ── Argument conversion ───────────────────────────────────────────────────────

describe("useSorobanContract — argument conversion", () => {
  async function renderWithArgs(args: unknown[]) {
    succeedWith(true)

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "call", args })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    return result
  }

  it("passes an Address ScVal through untouched", async () => {
    const address = scv.scvAddress(TEST_ADDRESS)
    const result = await renderWithArgs([address])

    expect(result.current.error).toBeNull()
    expect(lastCallArgs[0]).toBe(address)
  })

  it("passes a Symbol ScVal through untouched", async () => {
    const symbol = scv.scvSymbol("transfer")
    const result = await renderWithArgs([symbol])

    expect(result.current.error).toBeNull()
    expect(lastCallArgs[0]).toBe(symbol)
  })

  it("passes a u32 ScVal through untouched", async () => {
    const u32 = scv.scvU32(7)
    const result = await renderWithArgs([u32])

    expect(result.current.error).toBeNull()
    expect(lastCallArgs[0]).toBe(u32)
  })

  it("passes a negative i128 ScVal through untouched, at any magnitude", async () => {
    // Below -2^64, where the old hand-built Int128Parts with `hi: -1` was wrong.
    const veryNegative = BigInt("-340282366920938463463374607431768211")
    const scVal = scv.scvI128(veryNegative)

    const result = await renderWithArgs([scVal])

    expect(result.current.error).toBeNull()
    // The hook does no arithmetic of its own — the SDK's own value survives.
    expect(lastCallArgs[0]).toBe(scVal)
  })

  it("throws a clear error naming the XDR type for an ambiguous string", async () => {
    const result = await renderWithArgs(["transfer"])

    expect(result.current.error?.message).toMatch(/Symbol, String, or Address/)
    expect(result.current.data).toBeNull()
  })

  it("throws a clear error naming the XDR type for an ambiguous number", async () => {
    const result = await renderWithArgs([42])

    expect(result.current.error?.message).toMatch(/u32, i32, u64, i64, u128, or i128/)
    expect(result.current.data).toBeNull()
  })

  it("refuses a number beyond MAX_SAFE_INTEGER rather than truncating it", async () => {
    const result = await renderWithArgs([Number.MAX_SAFE_INTEGER + 2])

    expect(result.current.error?.message).toMatch(/MAX_SAFE_INTEGER/)
    expect(result.current.data).toBeNull()
  })

  it("refuses a bare bigint whose width is not stated", async () => {
    const result = await renderWithArgs([BigInt(1)])

    expect(result.current.error?.message).toMatch(/u64, i64, u128, or i128/)
  })

  it("converts a boolean without complaint — it is unambiguous", async () => {
    const result = await renderWithArgs([true])

    expect(result.current.error).toBeNull()
  })
})

// ── Spec-aware conversion ─────────────────────────────────────────────────────

/**
 * A stand-in for the SDK's `contract.Spec` covering
 * `fn balance(id: Address) -> i128` — the standard token signature the old
 * inference got wrong.
 */
function buildBalanceSpec(): ContractSpecLike {
  return {
    getFunc: (name: string) => {
      if (name !== "balance") throw new Error(`no such function ${name}`)
      return {
        inputs: () => [{ name: () => "id" }],
      }
    },
    funcArgsToScVals: (_name: string, args: object) => {
      const named = args as { id: unknown }
      // The spec declares `id: Address`, so a plain string is unambiguous here.
      return [scv.scvAddress(String(named.id))]
    },
    funcResToNative: (_name: string, value: { value: unknown }) => value.value,
  }
}

describe("useSorobanContract — spec-aware conversion", () => {
  it("converts arguments against the contract's declared parameter types", async () => {
    mockSimResult = {
      result: { retval: scv.scvI128(BigInt(42)) },
      cost: {},
      latestLedger: 1,
    }

    const { result } = renderHook(() =>
      useSorobanContract<bigint>({
        contractId: VALID_CONTRACT_ID,
        method: "balance",
        // A bare string is ambiguous without a spec; with one, the contract's
        // own `Address` parameter type resolves it.
        args: [TEST_ADDRESS],
        spec: buildBalanceSpec(),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe(BigInt(42))
    expect((lastCallArgs[0] as { type: string }).type).toBe("scvAddress")
  })

  it("reports an argument-count mismatch instead of calling the contract", async () => {
    succeedWith(true)

    const { result } = renderHook(() =>
      useSorobanContract({
        contractId: VALID_CONTRACT_ID,
        method: "balance",
        args: [],
        spec: buildBalanceSpec(),
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error?.message).toMatch(/expects 1 argument\(s\), received 0/)
  })
})

// ── Simulation source ─────────────────────────────────────────────────────────

describe("useSorobanContract — simulation source", () => {
  it("simulates as the connected wallet", async () => {
    mockWalletAddress = TEST_ADDRESS
    succeedWith(true)

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "balance" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(lastSimulatedSource).toBe(TEST_ADDRESS)
  })

  it("falls back to the documented placeholder when no wallet is connected", async () => {
    succeedWith(true)

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "balance" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(lastSimulatedSource).toBe(ANONYMOUS_SIMULATION_SOURCE)
  })

  it("honours an explicit source override", async () => {
    const OTHER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN"
    mockWalletAddress = TEST_ADDRESS
    succeedWith(true)

    const { result } = renderHook(() =>
      useSorobanContract({
        contractId: VALID_CONTRACT_ID,
        method: "balance",
        sourceAccount: OTHER,
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(lastSimulatedSource).toBe(OTHER)
  })
})

// ── Failures ──────────────────────────────────────────────────────────────────

describe("useSorobanContract — errors", () => {
  it("sets error when contract ID is invalid", async () => {
    const { result } = renderHook(() =>
      useSorobanContract({ contractId: "INVALID_ID", method: "balance" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error?.message).toMatch(/Invalid contract ID/)
    expect(result.current.data).toBeNull()
  })

  it("sets error on RPC simulation error response", async () => {
    mockSimResult = { error: "contract not found" }

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "balance" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error?.message).toMatch(/RPC simulation error/)
    expect(result.current.data).toBeNull()
  })

  it("sets error when RPC throws a network error", async () => {
    mockSimError = new Error("Network error")

    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "balance" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error).not.toBeNull()
    expect(result.current.data).toBeNull()
  })

  it("does not call RPC when contractId is empty", async () => {
    const { result } = renderHook(() => useSorobanContract({ contractId: "", method: "balance" }))

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()
  })

  it("does not call RPC when method is empty", async () => {
    const { result } = renderHook(() =>
      useSorobanContract({ contractId: VALID_CONTRACT_ID, method: "" })
    )

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    expect(result.current.data).toBeNull()
  })
})
