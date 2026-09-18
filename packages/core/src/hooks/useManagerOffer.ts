import { useState } from "react"
import { Operation, Asset as SdkAsset, TransactionBuilder } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import { createStellarError, toStellarError } from "../errors"
import {
  StellarError,
  TransactionResult,
  Asset,
  ManageOfferParams,
  UseManageOfferReturn,
} from "../types"
import { isNativeAsset, isIssuedAsset, isLiquidityPoolShares } from "../utils"

/** The Horizon submission failure shape this hook reads result codes from. */
interface HorizonSubmissionError {
  response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } }
}

// Helper to convert library Asset to StellarSdk Asset
function toSdkAsset(asset: Asset): SdkAsset {
  if (isNativeAsset(asset)) return SdkAsset.native()
  if (isLiquidityPoolShares(asset)) {
    throw new Error("VALIDATION_ERROR: Cannot use liquidity pool shares in offers")
  }
  return new SdkAsset(asset.code, asset.issuer)
}

// Compare assets
function assetsEqual(a: Asset, b: Asset): boolean {
  if (isNativeAsset(a) && isNativeAsset(b)) return true
  if (isIssuedAsset(a) && isIssuedAsset(b)) {
    return a.code === b.code && a.issuer === b.issuer
  }
  return false
}

// Validate positive numbers without float arithmetic
function isPositive(val: string | { n: number; d: number }): boolean {
  if (typeof val === "string") {
    const match = val.match(/^-?([0-9]*\.?[0-9]+)$/)
    if (!match || val.startsWith("-")) return false
    const numStr = match[1].replace(".", "")
    return numStr.split("").some(c => c !== "0")
  }
  return val.n > 0 && val.d > 0
}

export function useManageOffer(): UseManageOfferReturn {
  const { network, networkConfig, wallet } = useStellarContext()
  const publicKey = wallet.address
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  const execute = async (
    params: ManageOfferParams,
    offerId: string = "0",
    isCancel: boolean = false
  ): Promise<TransactionResult | null> => {
    if (!wallet.connected || !publicKey || !wallet.wallet) {
      setError(
        createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
      )
      return null
    }

    setLoading(true)
    setError(null)

    try {
      if (assetsEqual(params.selling, params.buying)) {
        throw new Error("VALIDATION_ERROR: Selling and buying assets must be different")
      }

      if (!isCancel) {
        if (!isPositive(params.amount)) throw new Error("VALIDATION_ERROR: Amount must be positive")
        if (!isPositive(params.price)) throw new Error("VALIDATION_ERROR: Price must be positive")
      }

      if (isCancel && (!offerId || offerId === "0")) {
        throw new Error("VALIDATION_ERROR: Missing offerId for cancellation")
      }

      const server = getHorizonServer(networkConfig)
      const account = await server.loadAccount(publicKey)
      const { networkPassphrase } = networkConfig
      const fee = await resolveFee(asFeeSource(server), {})

      const selling = toSdkAsset(params.selling)
      const buying = toSdkAsset(params.buying)
      const price = params.price

      // manageBuyOffer names the amount `buyAmount`; manageSellOffer uses
      // `amount`. They are not interchangeable.
      const op =
        params.side === "buy"
          ? Operation.manageBuyOffer({
              selling,
              buying,
              buyAmount: params.amount,
              price,
              offerId,
            })
          : Operation.manageSellOffer({
              selling,
              buying,
              amount: params.amount,
              price,
              offerId,
            })

      const tx = new TransactionBuilder(account, { fee, networkPassphrase })
        .addOperation(op)
        .setTimeout(30)
        .build()

      const adapter = getWalletAdapter(wallet.wallet)
      const signedXdr = await adapter.signTransaction(tx.toXDR(), {
        address: publicKey,
        network,
        networkPassphrase,
      })

      const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
      const res = await server.submitTransaction(signed)
      const txResult: TransactionResult = {
        hash: res.hash,
        status: res.successful ? "success" : "failed",
        ledger: res.ledger,
      }

      setResult(txResult)
      return txResult
    } catch (err: unknown) {
      let mappedErr: unknown = err
      const resultCodes = (err as HorizonSubmissionError)?.response?.data?.extras?.result_codes

      if (resultCodes?.operations?.includes("op_low_reserve")) {
        mappedErr = new Error("Low reserve: You need more XLM to hold another offer")
      }

      setError(toStellarError(mappedErr))
      return null
    } finally {
      setLoading(false)
    }
  }

  const createOffer = async (o: ManageOfferParams) => execute(o, "0", false)

  const updateOffer = async (offerId: string, o: ManageOfferParams) => {
    if (!offerId || offerId === "0") {
      setError(new Error("VALIDATION_ERROR: offerId is required for updateOffer") as StellarError)
      return null
    }
    return execute(o, offerId, false)
  }

  const cancelOffer = async (offerId: string) => {
    if (!offerId || offerId === "0") {
      setError(new Error("VALIDATION_ERROR: offerId is required for cancelOffer") as StellarError)
      return null
    }

    if (!wallet.connected) {
      setError(
        createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
      )
      return null
    }

    setLoading(true)
    setError(null)
    try {
      // Look up the existing offer so the cancel carries exactly matching assets.
      const server = getHorizonServer(networkConfig)
      const offer = await server.offers().offer(offerId).call()

      const selling: Asset =
        offer.selling.asset_type === "native"
          ? "XLM"
          : { code: offer.selling.asset_code!, issuer: offer.selling.asset_issuer! }

      const buying: Asset =
        offer.buying.asset_type === "native"
          ? "XLM"
          : { code: offer.buying.asset_code!, issuer: offer.buying.asset_issuer! }

      return await execute(
        { selling, buying, amount: "0", price: offer.price_r, side: "sell" },
        offerId,
        true
      )
    } catch (err) {
      setError(toStellarError(err))
      return null
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setError(null)
    setResult(null)
    setLoading(false)
  }

  return { createOffer, updateOffer, cancelOffer, loading, error, result, reset }
}
