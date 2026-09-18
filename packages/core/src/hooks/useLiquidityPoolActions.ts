import { useState } from "react"
import { Operation, TransactionBuilder } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isBrowser } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import { createStellarError, toStellarError, toSubmissionError } from "../errors"
import type { FeeOptions, StellarError, TransactionResult } from "../types"

export interface LiquidityPoolDepositOptions extends FeeOptions {
  poolId: string
  maxAmountA: string
  maxAmountB: string
  minPrice: string | { n: number; d: number }
  maxPrice: string | { n: number; d: number }
}

export interface LiquidityPoolWithdrawOptions extends FeeOptions {
  poolId: string
  amount: string
  minAmountA: string
  minAmountB: string
}

/**
 * Deposits into and withdraws from an AMM liquidity pool.
 *
 * Both actions build, sign, and submit a transaction through the connected
 * wallet, using the same fee strategy as every other writing hook: the bid
 * comes from the network's current base fee, not the SDK's `BASE_FEE` minimum.
 */
export function useLiquidityPoolActions() {
  const { network, networkConfig, wallet } = useStellarContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  /** Shared build/sign/submit path — the two actions differ only by operation. */
  async function submit(
    operation: ReturnType<typeof Operation.liquidityPoolDeposit>,
    feeOptions: FeeOptions
  ): Promise<TransactionResult | null> {
    if (!wallet.connected || !wallet.address || !wallet.wallet) {
      const err = createStellarError(
        "WALLET_NOT_CONNECTED",
        "Wallet not connected. Call connect() first."
      )
      setError(err)
      return null
    }

    if (!isBrowser()) {
      const err = createStellarError(
        "VALIDATION_ERROR",
        "Transaction signing is only available in the browser. " +
          'Move your component to a "use client" boundary in Next.js / Remix.'
      )
      setError(err)
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const server = getHorizonServer(networkConfig)
      const sourceAcc = await server.loadAccount(wallet.address)
      const { networkPassphrase } = networkConfig
      const fee = await resolveFee(asFeeSource(server), feeOptions)

      const tx = new TransactionBuilder(sourceAcc, { fee, networkPassphrase })
        .addOperation(operation)
        .setTimeout(30)
        .build()

      const adapter = getWalletAdapter(wallet.wallet)
      const signedXdr = await adapter.signTransaction(tx.toXDR(), {
        address: wallet.address,
        network,
        networkPassphrase,
      })

      const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
      const res = await server.submitTransaction(signed)

      if (!res.successful) {
        const failed: TransactionResult = { hash: res.hash, status: "failed" }
        setResult(failed)
        throw toSubmissionError(res)
      }

      const outcome: TransactionResult = { hash: res.hash, status: "success" }
      setResult(outcome)
      return outcome
    } catch (err) {
      setError(toStellarError(err))
      return null
    } finally {
      setLoading(false)
    }
  }

  const deposit = ({
    poolId,
    maxAmountA,
    maxAmountB,
    minPrice,
    maxPrice,
    ...feeOptions
  }: LiquidityPoolDepositOptions) =>
    submit(
      Operation.liquidityPoolDeposit({
        liquidityPoolId: poolId,
        maxAmountA,
        maxAmountB,
        minPrice,
        maxPrice,
      }),
      feeOptions
    )

  const withdraw = ({
    poolId,
    amount,
    minAmountA,
    minAmountB,
    ...feeOptions
  }: LiquidityPoolWithdrawOptions) =>
    submit(
      Operation.liquidityPoolWithdraw({
        liquidityPoolId: poolId,
        amount,
        minAmountA,
        minAmountB,
      }),
      feeOptions
    )

  const reset = () => {
    setError(null)
    setResult(null)
    setLoading(false)
  }

  return { deposit, withdraw, loading, error, result, reset }
}
