// packages/core/src/hooks/useSorobanWrite.ts

import { useState, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { toStellarError } from "../errors"
import { invokeContract } from "../actions/sorobanWrite"
import type { SorobanInvokeOptions, UseSorobanWriteReturn } from "../types"
import type { StellarError } from "../errors"

/**
 * Invokes a state-changing Soroban contract method through the connected wallet.
 *
 * A thin React adapter over the framework-neutral {@link invokeContract}
 * action, which owns validation, simulation, signing, submission and polling;
 * this hook owns only `loading`/`error`/`result`.
 */
export function useSorobanWrite<T = unknown>(): UseSorobanWriteReturn<T> {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<{ hash: string; result: T } | null>(null)

  const invoke = useCallback(
    async (options: SorobanInvokeOptions) => {
      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const finalResult = await invokeContract<T>(
          { network, networkConfig, wallet, queryStore },
          options
        )
        setResult(finalResult)
        return finalResult
      } catch (err: unknown) {
        // toStellarError returns null for deliberate cancellations (AbortError);
        // those must not be reported as a failure, but the caller still unwinds.
        const stellarError = toStellarError(err)
        if (!stellarError) throw err
        setError(stellarError)
        throw stellarError
      } finally {
        setLoading(false)
      }
    },
    [network, networkConfig, wallet, queryStore]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])

  return {
    invoke,
    loading,
    error,
    result,
    reset,
  }
}
