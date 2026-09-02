import { useState, useCallback } from "react"
import { TransactionBuilder, Operation, Asset as StellarAsset, Memo } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isNativeAsset, isIssuedAsset, isBrowser } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import {
  createStellarError,
  toStellarError,
  toSubmissionError,
  StellarError as StellarErrorClass,
} from "../errors"
import { accountKey } from "../cache"
import type { SendPaymentOptions, SendPaymentResult, Asset, StellarError } from "../types"

export interface UseSendPaymentReturn {
  send: (options: SendPaymentOptions) => Promise<SendPaymentResult & { error?: string }>
  loading: boolean
  error: StellarError | null
  result: SendPaymentResult | null
  reset: () => void
}

/**
 * Builds, signs, and submits a payment transaction to the Stellar network.
 *
 * The fee is bid from the network's current base fee, multiplied by
 * {@link DEFAULT_FEE_MULTIPLIER}, rather than pinned to the SDK's `BASE_FEE`
 * constant — that constant is the network minimum, which is rejected during
 * congestion. A fee is a maximum bid, not a charge: the network takes only
 * what it needs, so a generous bid costs nothing on a quiet ledger.
 *
 * @returns `{ send, loading, error, result, reset }`
 *
 * @example
 * const { send, loading } = useSendPayment()
 * await send({ to: "G...", asset: "XLM", amount: "10" })
 *
 * @example
 * // Bid harder during known congestion, or pin the fee exactly.
 * await send({ to: "G...", asset: "XLM", amount: "10", feeMultiplier: 50 })
 * await send({ to: "G...", asset: "XLM", amount: "10", fee: "100000" })
 */
export function useSendPayment(): UseSendPaymentReturn {
  const { network, networkConfig, wallet, queryStore } = useStellarContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<SendPaymentResult | null>(null)

  const send = useCallback(
    async (options: SendPaymentOptions): Promise<SendPaymentResult & { error?: string }> => {
      if (!wallet.connected || !wallet.address) {
        throw createStellarError(
          "WALLET_NOT_CONNECTED",
          "Wallet not connected. Call connect() first."
        )
      }
      if (!wallet.wallet) {
        throw new Error("No wallet adapter selected. Call connect() first.")
      }

      if (!isBrowser()) {
        throw createStellarError(
          "VALIDATION_ERROR",
          "Transaction signing is only available in the browser. " +
            'Move your component to a "use client" boundary in Next.js / Remix.'
        )
      }

      // Check for network mismatch
      if (wallet.walletNetwork && wallet.network !== wallet.walletNetwork) {
        throw createStellarError(
          "WRONG_NETWORK",
          `Network mismatch: Provider is on ${wallet.network} but wallet is on ${wallet.walletNetwork}. ` +
            `Switch your wallet to ${wallet.network} or call refreshWalletNetwork() to update.`
        )
      }

      setLoading(true)
      setError(null)
      setResult(null)

      let txHash = ""

      try {
        const stellarAsset = toStellarAsset(options.asset)
        const server = getHorizonServer(network)
        const sourceAcc = await server.loadAccount(wallet.address)
        // Resolved once by the provider, so a signature can never be bound to
        // a network the caller did not configure.
        const { networkPassphrase } = networkConfig
        const fee = await resolveFee(asFeeSource(server), options)

        const operation = Operation.payment({
          destination: options.to,
          asset: stellarAsset,
          amount: options.amount,
        })

        const builder = new TransactionBuilder(sourceAcc, {
          fee,
          networkPassphrase,
        }).addOperation(operation)

        if (options.memo) {
          builder.addMemo(Memo.text(options.memo))
        }

        builder.setTimeout(30)
        const tx = builder.build()

        // Compute the transaction hash BEFORE submission so it is available
        // even if Horizon times out (504). The hash is deterministic from the
        // signed envelope, so we can return it on timeout and let the caller
        // poll useTransaction(hash) to find out what actually happened.
        txHash = tx.hash().toString("hex")
        const xdr = tx.toXDR()

        // Sign & submit via the active wallet's adapter
        const adapter = getWalletAdapter(wallet.wallet)
        const signedTxXdr = await adapter.signTransaction(xdr, {
          address: wallet.address,
          network,
          networkPassphrase,
        })

        const signed = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase)
        const res = await server.submitTransaction(signed)

        if (!res.successful) {
          const failedOutcome: SendPaymentResult = {
            hash: res.hash,
            status: "failed",
          }
          setResult(failedOutcome)
          throw toSubmissionError(res)
        }

        const outcome: SendPaymentResult = {
          hash: res.hash,
          status: "success",
        }

        setResult(outcome)

        // Invalidate the sender's account/balance cache so any mounted hook
        // sees fresh data on the next render cycle.
        if (wallet.address) {
          queryStore.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))
        }

        return outcome
      } catch (err) {
        const stellarError = toStellarError(err)

        // If toStellarError returns null, it was an abort (deliberate cancellation).
        // Don't set error state for aborts.
        if (!stellarError) {
          return { hash: "", status: "failed", error: "Request was cancelled" }
        }

        // On TX_TIMEOUT (504), we have the hash but don't know the outcome yet.
        // Return the hash so the caller can poll useTransaction(hash).
        if (stellarError.code === "TX_TIMEOUT") {
          const timeoutOutcome: SendPaymentResult = {
            hash: txHash,
            status: "pending",
          }
          setResult(timeoutOutcome)
          setError(stellarError)
          // Attach the hash to the error so it's accessible
          const errorWithHash = new StellarErrorClass(stellarError.code, stellarError.message, {
            raw: stellarError.raw,
            hash: txHash,
          })
          throw errorWithHash
        }

        setError(stellarError)
        throw stellarError
      } finally {
        setLoading(false)
      }
    },
    [network, networkConfig, wallet, queryStore]
  )

  const reset = useCallback(() => {
    setError(null)
    setResult(null)
  }, [])

  return { send, loading, error, result, reset }
}

function toStellarAsset(asset: Asset): StellarAsset {
  if (isNativeAsset(asset)) return StellarAsset.native()
  if (isIssuedAsset(asset)) return new StellarAsset(asset.code, asset.issuer)
  throw createStellarError(
    "VALIDATION_ERROR",
    `Unsupported asset: ${JSON.stringify(asset)}. ` + `Pass "XLM" or { code, issuer }.`
  )
}
