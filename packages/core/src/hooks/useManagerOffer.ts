import { useState } from "react"
import { Operation, Asset as SdkAsset } from "@stellar/stellar-sdk"
import { useStellar } from "../providers/StellarProvider"
import {
  StellarError,
  TransactionResult,
  Asset,
  ManageOfferParams,
  UseManageOfferReturn,
} from "../types"
import { isNativeAsset, isLiquidityPoolShares } from "../utils"

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
  if (!isNativeAsset(a) && !isNativeAsset(b) && !isLiquidityPoolShares(a) && !isLiquidityPoolShares(b)) {
    return (a as any).code === (b as any).code && (a as any).issuer === (b as any).issuer
  }
  return false
}

// Validate positive numbers without float arithmetic
function isPositive(val: string | { n: number; d: number }): boolean {
  if (typeof val === "string") {
    const match = val.match(/^-?([0-9]*\.?[0-9]+)$/)
    if (!match || val.startsWith("-")) return false
    const numStr = match[1].replace(".", "")
    return numStr.split("").some((c) => c !== "0")
  }
  return val.n > 0 && val.d > 0
}

export function useManageOffer(): UseManageOfferReturn {
  const { server, adapter, publicKey } = useStellar()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)

  const execute = async (
    params: ManageOfferParams,
    offerId: string = "0",
    isCancel: boolean = false
  ): Promise<TransactionResult | null> => {
    if (!server || !adapter || !publicKey) {
      setError(new Error("StellarProvider not initialized") as StellarError)
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

      const account = await server.loadAccount(publicKey)

      const opParams = {
        selling: toSdkAsset(params.selling),
        buying: toSdkAsset(params.buying),
        amount: params.amount,
        price: params.price as any, // SDK accepts string | {n, d}
        offerId,
      }

      const op =
        params.side === "buy"
          ? Operation.manageBuyOffer(opParams)
          : Operation.manageSellOffer(opParams)

      const { signedTx } = await adapter.signTransaction({
        transaction: op,
        account,
      })

      const res = await server.submitTransaction(signedTx)
      const txResult: TransactionResult = {
        hash: res.hash,
        status: res.successful ? "success" : "failed",
        ledger: res.ledger,
      }
      
      setResult(txResult)
      return txResult
    } catch (err: any) {
      let mappedErr = err
      const resultCodes = err?.response?.data?.extras?.result_codes

      if (resultCodes?.operations?.includes("op_low_reserve")) {
        mappedErr = new Error("Low reserve: You need more XLM to hold another offer")
      }

      setError(mappedErr as StellarError)
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

    if (!server) {
      setError(new Error("StellarProvider not initialized") as StellarError)
      return null
    }

    setLoading(true)
    setError(null)
    try {
      // Look up the existing offer to get exactly matching assets to fulfill the API structure
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
    } catch (err: any) {
      setError(err as StellarError)
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