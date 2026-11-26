import { Operation, TransactionBuilder, type xdr } from "@stellar/stellar-sdk"
import { getHorizonServer, isBrowser, DEFAULT_TRANSACTION_TIMEOUT } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import { createStellarError, toStellarError, toSubmissionError } from "../errors"
import { offlineError, onlineManager } from "../runtime/onlineManager"
// From the module itself, not the "../cache" index, which re-exports the React `useQuery`.
import { accountKey, liquidityPoolKey } from "../cache/keys"
import type {
  FeeOptions,
  NetworkConfig,
  StellarNetwork,
  TransactionResult,
  WalletState,
} from "../types"

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

/** The narrow view of the runtime the liquidity pool actions need. */
export interface LiquidityPoolRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  /** When given, the source account and the pool are invalidated after a successful submission. */
  queryStore?: { invalidate: (key: readonly unknown[]) => void }
  /** Seconds the built transaction stays valid. Defaults to 30. */
  transactionTimeout?: number
}

/**
 * Marks a submission Horizon rejected (`successful: false`). The error carries
 * `.hash`, so an adapter can record a `status: "failed"` result before
 * surfacing the error — the same contract as `sendPayment`.
 */
export function isLiquidityPoolSubmissionFailure(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (error as { isSubmissionFailure?: boolean }).isSubmissionFailure
  )
}

/**
 * Builds, signs, and submits one liquidity pool operation through the
 * connected wallet. Shared by {@link depositLiquidity} and
 * {@link withdrawLiquidity}, which differ only by operation.
 *
 * @throws {StellarError} on every non-success path: `WALLET_NOT_CONNECTED`,
 *         `VALIDATION_ERROR` (not in a browser), `NETWORK_ERROR` when offline, a mapped submission
 *         error (marked, see {@link isLiquidityPoolSubmissionFailure}), or any
 *         mapped network error. An abort rethrows the original error.
 */
async function submitPoolOperation(
  runtime: LiquidityPoolRuntime,
  poolId: string,
  operation: xdr.Operation,
  feeOptions: FeeOptions
): Promise<TransactionResult> {
  const { network, networkConfig, wallet, queryStore } = runtime

  if (!wallet.connected || !wallet.address || !wallet.wallet) {
    throw createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
  }

  if (!isBrowser()) {
    throw createStellarError(
      "VALIDATION_ERROR",
      "Transaction signing is only available in the browser. " +
        'Move your component to a "use client" boundary in Next.js / Remix.'
    )
  }

  // Fail fast offline — a signed transaction is never queued for later.
  if (!onlineManager.isOnline()) throw offlineError()

  try {
    const server = getHorizonServer(networkConfig)
    const sourceAcc = await server.loadAccount(wallet.address)
    const { networkPassphrase } = networkConfig
    const fee = await resolveFee(asFeeSource(server), feeOptions)

    const tx = new TransactionBuilder(sourceAcc, { fee, networkPassphrase })
      .addOperation(operation)
      .setTimeout(runtime.transactionTimeout ?? DEFAULT_TRANSACTION_TIMEOUT)
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
      throw Object.assign(toSubmissionError(res), { isSubmissionFailure: true, hash: res.hash })
    }

    // The deposit or withdrawal changed both the account's balances and the pool's reserves.
    queryStore?.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))
    queryStore?.invalidate(liquidityPoolKey(networkConfig.horizonUrl, network, poolId))

    return { hash: res.hash, status: "success" }
  } catch (err) {
    throw toStellarError(err) ?? err
  }
}

/** Deposits into an AMM liquidity pool. See {@link submitPoolOperation} for the error contract. */
export function depositLiquidity(
  runtime: LiquidityPoolRuntime,
  { poolId, maxAmountA, maxAmountB, minPrice, maxPrice, ...feeOptions }: LiquidityPoolDepositOptions
): Promise<TransactionResult> {
  return submitPoolOperation(
    runtime,
    poolId,
    Operation.liquidityPoolDeposit({
      liquidityPoolId: poolId,
      maxAmountA,
      maxAmountB,
      minPrice,
      maxPrice,
    }),
    feeOptions
  )
}

/** Withdraws from an AMM liquidity pool. See {@link submitPoolOperation} for the error contract. */
export function withdrawLiquidity(
  runtime: LiquidityPoolRuntime,
  { poolId, amount, minAmountA, minAmountB, ...feeOptions }: LiquidityPoolWithdrawOptions
): Promise<TransactionResult> {
  return submitPoolOperation(
    runtime,
    poolId,
    Operation.liquidityPoolWithdraw({
      liquidityPoolId: poolId,
      amount,
      minAmountA,
      minAmountB,
    }),
    feeOptions
  )
}
