import { useState, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { isBrowser } from "../utils"
import { createAccount as createAccountAction } from "../actions/createAccount"
import { toStellarError, type StellarError } from "../errors"
import type { UseCreateAccountReturn, CreateAccountOptions, TransactionResult } from "../types"

export function useCreateAccount(): UseCreateAccountReturn {
  const { network, networkConfig, wallet, queryStore, transactionTimeout } = useStellarContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  const createAccount = useCallback(
    async (options: CreateAccountOptions) => {
      if (!isBrowser()) return Promise.reject(new Error("SSR not supported"))
      setLoading(true)
      setError(null)
      setResult(null)
      try {
        const outcome = await createAccountAction(
          { network, networkConfig, wallet, queryStore, transactionTimeout },
          options
        )
        setResult(outcome)
        return outcome
      } catch (caught) {
        const stellarError = toStellarError(caught)
        setError(stellarError)
        if (stellarError?.code === "TX_TIMEOUT")
          setResult({ hash: stellarError.hash ?? "", status: "pending" })
        throw stellarError
      } finally {
        setLoading(false)
      }
    },
    [network, networkConfig, wallet, queryStore, transactionTimeout]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])
  return { createAccount, loading, error, result, reset }
}
