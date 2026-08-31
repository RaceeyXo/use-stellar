import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  SorobanRpc,
  Contract,
  xdr,
  scValToNative,
  TransactionBuilder,
  BASE_FEE,
  Account,
} from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { createStellarError, toStellarError } from "../errors"
import { useQuery, sorobanContractKey } from "../cache"
import type { ContractCallOptions, ContractSpecLike, StellarError } from "../types"

/**
 * The account simulations run as when no wallet is connected.
 */
export const ANONYMOUS_SIMULATION_SOURCE =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

export interface UseSorobanContractReturn<T = unknown> {
  data: T | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

function toScVal(arg: unknown, index: number): xdr.ScVal {
  if (arg instanceof xdr.ScVal) return arg
  if (typeof arg === "boolean") return xdr.ScVal.scvBool(arg)
  if (typeof arg === "string") {
    throw new Error(
      `Argument ${index} is a string, which could be Symbol, String, or Address. ` +
        "Pass an xdr.ScVal so the type is explicit."
    )
  }
  if (typeof arg === "number") {
    throw new Error(
      `Argument ${index} is a number, which could be u32, i32, u64, i64, u128, or i128. ` +
        "Pass an xdr.ScVal so the type is explicit."
    )
  }
  if (typeof arg === "bigint") {
    throw new Error(
      `Argument ${index} is a bigint, which could be u64, i64, u128, or i128. ` +
        "Pass an xdr.ScVal so the width is explicit."
    )
  }
  throw new Error(
    `Argument ${index} has unsupported type ${typeof arg}. Pass an xdr.ScVal directly.`
  )
}

function describeArg(arg: unknown): string {
  if (arg instanceof xdr.ScVal) return arg.toXDR("base64")
  if (typeof arg === "bigint") return `${arg}n`
  try {
    return JSON.stringify(arg) ?? String(arg)
  } catch {
    return String(arg)
  }
}

function isValidContractId(id: string): boolean {
  return typeof id === "string" && /^C[A-Z2-7]{55}$/.test(id)
}

/**
 * Simulates a read-only Soroban contract call when its inputs change.
 *
 * Prefer passing `xdr.ScVal[]` for contract arguments. Callers should memoize
 * non-primitive argument values so their serialized meaning remains explicit
 * and serialization work is avoided on unrelated parent renders.
 */
export function useSorobanContract({
  contractId,
  method,
  args = [],
}: ContractCallOptions): UseSorobanContractReturn {
  const { networkConfig } = useStellarContext()

  const [data, setData] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  const argsKey = useMemo(
    () =>
      args
        .map(arg => (arg instanceof xdr.ScVal ? arg.toXDR("base64") : JSON.stringify(arg)))
        .join("|"),
    [args]
  )
  const argsRef = useRef(args)
  argsRef.current = args

  const callContract = useCallback(async () => {
    if (!contractId || !method) {
      setData(null)
      setError(null)
      return
    }

    if (!isValidContractId(contractId)) {
      setError(
        toStellarError(
          new Error(
            `Invalid contract ID "${contractId}". Must be a C-prefixed 56-character Stellar address.`
          )
function buildSpecArgs(
  spec: ContractSpecLike,
  method: string,
  args: readonly unknown[]
): Record<string, unknown> {
  const params = spec.getFunc(method).inputs() as { name: () => { toString: () => string } }[]
  if (args.length !== params.length) {
    throw new Error(
      `Contract method "${method}" expects ${params.length} argument(s), received ${args.length}.`
    )
  }
  const named: Record<string, unknown> = {}
  params.forEach((param, index) => {
    named[param.name().toString()] = args[index]
  })
  return named
}

/**
 * Reads a Soroban contract by simulating a call against the RPC server.
 *
 * Results are cached in the shared QueryStore and deduplicated.
 *
 * @example
 * const { data } = useSorobanContract<bigint>({
 *   contractId: "CB...",
 *   method: "balance",
 *   args: [new Address(address).toScVal()],
 * })
 */
export function useSorobanContract<T = unknown>({
  contractId,
  method,
  args = [],
  spec,
  sourceAccount: sourceAccountOverride,
  staleTime,
}: ContractCallOptions & { staleTime?: number }): UseSorobanContractReturn<T> {
  const { networkConfig, wallet, queryStore } = useStellarContext()

  const source = sourceAccountOverride ?? wallet.address ?? ANONYMOUS_SIMULATION_SOURCE
  const argsKey = args.map(describeArg).join("|")
  const { sorobanUrl, networkPassphrase } = networkConfig
  const hasSpec = Boolean(spec)

  const queryKey =
    contractId && method
      ? sorobanContractKey(sorobanUrl, networkConfig.network, contractId, method, argsKey, source)
      : (["sorobanContract", "disabled"] as const)

  const {
    data,
    loading,
    error: rawError,
    refetch,
  } = useQuery<T>({
    queryKey,
    queryFn: async () => {
      if (!isValidContractId(contractId)) {
        throw new Error(
          `Invalid contract ID "${contractId}". Must be a C-prefixed 56-character Stellar address.`
        )
      }

      const server = new SorobanRpc.Server(sorobanUrl, {
        allowHttp: sorobanUrl.startsWith("http://"),
      })

      let scArgs: xdr.ScVal[]
      try {
        scArgs = argsRef.current.map(toScVal)
        scArgs = spec
          ? (spec.funcArgsToScVals(method, buildSpecArgs(spec, method, args)) as xdr.ScVal[])
          : args.map(toScVal)
      } catch (argErr) {
        throw new Error(
          `Argument conversion failed: ${argErr instanceof Error ? argErr.message : String(argErr)}`
        )
      }

      const contract = new Contract(contractId)
      const operation = contract.call(method, ...scArgs)
      const simulationSource = new Account(source, "0")

      const tx = new TransactionBuilder(simulationSource, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build()

      const simResult = await server.simulateTransaction(tx)

      if (SorobanRpc.Api.isSimulationError(simResult)) {
        throw createStellarError("SIMULATION_FAILED", `RPC simulation error: ${simResult.error}`)
      }
      if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
        throw createStellarError(
          "SIMULATION_FAILED",
          "Simulation did not return a successful result."
        )
      }

      const returnVal = simResult.result?.retval
      if (!returnVal) return null as unknown as T

      try {
        return (spec ? spec.funcResToNative(method, returnVal) : scValToNative(returnVal)) as T
      } catch {
        return { raw: returnVal.toXDR("base64") } as T
      }
    } catch (err) {
      setData(null)
      setError(toStellarError(err))
    } finally {
      setLoading(false)
    }
  }, [contractId, method, argsKey, networkConfig.sorobanUrl, networkConfig.network])

  useEffect(() => {
    callContract()
  }, [callContract])

  return { data, loading, error, refetch: callContract }
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(contractId && method),
  })

  const error = rawError ? toStellarError(rawError) : null

  // Suppress unused warning for hasSpec — it's used for cache key stability
  void hasSpec

  return { data, loading, error, refetch }
}
