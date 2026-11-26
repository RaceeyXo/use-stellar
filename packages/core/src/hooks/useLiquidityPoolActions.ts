import { useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { toStellarError } from "../errors"
import {
  depositLiquidity,
  isLiquidityPoolSubmissionFailure,
  withdrawLiquidity,
  type LiquidityPoolDepositOptions,
  type LiquidityPoolWithdrawOptions,
} from "../actions/liquidityPool"
import type { StellarError, TransactionResult } from "../types"

export type { LiquidityPoolDepositOptions, LiquidityPoolWithdrawOptions }

/**
 * Deposits into and withdraws from an AMM liquidity pool.
 *
 * Both actions build, sign, and submit a transaction through the connected
 * wallet, using the same fee strategy as every other writing hook: the bid
 * comes from the network's current base fee, not the SDK's `BASE_FEE` minimum.
 *
 * A thin React adapter over the framework-neutral {@link depositLiquidity} and
 * {@link withdrawLiquidity} actions; it owns only the component state.
 */
export function useLiquidityPoolActions() {
  const context = useStellarContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  async function run(action: () => Promise<TransactionResult>): Promise<TransactionResult | null> {
    setLoading(true)
    setError(null)
    try {
      const outcome = await action()
      setResult(outcome)
      return outcome
    } catch (err) {
      if (isLiquidityPoolSubmissionFailure(err)) {
        setResult({ hash: (err as StellarError).hash ?? "", status: "failed" })
      }
      setError(toStellarError(err))
      return null
    } finally {
      setLoading(false)
    }
  }

  const deposit = (options: LiquidityPoolDepositOptions) =>
    run(() => depositLiquidity(context, options))

  const withdraw = (options: LiquidityPoolWithdrawOptions) =>
    run(() => withdrawLiquidity(context, options))

  const reset = () => {
    setError(null)
    setResult(null)
    setLoading(false)
  }

  return { deposit, withdraw, loading, error, result, reset }
}
