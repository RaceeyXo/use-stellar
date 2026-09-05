import { useMemo } from "react"
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
    // A number past the safe range has already lost precision before it reached
    // us, so the width is not the only problem — say so, rather than implying a
    // cast would fix it.
    if (!Number.isSafeInteger(arg)) {
      throw new Error(
        `Argument ${index} is a number outside Number.MAX_SAFE_INTEGER and cannot be ` +
          "converted without losing precision. Pass a bigint wrapped in the explicit " +
          "xdr.ScVal width you mean (for example xdr.ScVal.scvI128)."
      )
    }
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
      ? sorobanContractKey(
          sorobanUrl,
          networkConfig.network,
          contractId,
          method,
          argsKey,
          source,
          hasSpec ? "spec" : "raw"
        )
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
    },
    store: queryStore,
    staleTime,
    enabled: Boolean(contractId && method),
  })

  // Keyed on the raw error's identity, which the store keeps stable for as long
  // as the failure stands. Re-wrapping on every render would hand consumers a
  // new object each time and re-fire any `useEffect(..., [error])` downstream.
  const error = useMemo(() => (rawError ? toStellarError(rawError) : null), [rawError])

  return { data, loading, error, refetch }
}
