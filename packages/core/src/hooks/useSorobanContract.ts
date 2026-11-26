import { useMemo } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { toStellarError } from "../errors"
import { useQuery, sorobanContractKey } from "../cache"
import { simulateContractCall, argsKey, ANONYMOUS_SIMULATION_SOURCE } from "../queries/soroban"
import type { ContractCallOptions, StellarError } from "../types"

export { ANONYMOUS_SIMULATION_SOURCE }

export interface UseSorobanContractReturn<T = unknown> {
  data: T | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

/**
 * Reads a Soroban contract by simulating a call against the RPC server.
 *
 * Results are cached in the shared QueryStore and deduplicated. The actual
 * simulation logic (contract-ID validation, argument serialization, and
 * result decoding) lives in the framework-neutral {@link simulateContractCall}.
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
  maxRetries,
}: ContractCallOptions & {
  staleTime?: number
  /**
   * Maximum number of automatic retries on retriable failures (429, 5xx,
   * network errors). Default: 3. Set to 0 to disable.
   */
  maxRetries?: number
}): UseSorobanContractReturn<T> {
  const { networkConfig, wallet, queryStore } = useStellarContext()

  const source = sourceAccountOverride ?? wallet.address ?? ANONYMOUS_SIMULATION_SOURCE
  const serializedArgs = argsKey(args)
  const { sorobanUrl } = networkConfig
  const hasSpec = Boolean(spec)

  const queryKey =
    contractId && method
      ? sorobanContractKey(
          sorobanUrl,
          networkConfig.network,
          contractId,
          method,
          serializedArgs,
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
    queryFn: () =>
      simulateContractCall<T>(networkConfig, {
        contractId,
        method,
        args,
        spec,
        sourceAccount: source,
      }),
    store: queryStore,
    staleTime,
    enabled: Boolean(contractId && method),
    maxRetries,
  })

  // Keyed on the raw error's identity, which the store keeps stable for as long
  // as the failure stands. Re-wrapping on every render would hand consumers a
  // new object each time and re-fire any `useEffect(..., [error])` downstream.
  const error = useMemo(() => (rawError ? toStellarError(rawError) : null), [rawError])

  return { data, loading, error, refetch }
}
