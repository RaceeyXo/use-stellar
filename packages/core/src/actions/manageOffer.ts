import { Operation, Asset as SdkAsset, TransactionBuilder } from "@stellar/stellar-sdk"
import {
  getHorizonServer,
  DEFAULT_TRANSACTION_TIMEOUT,
  isNativeAsset,
  isIssuedAsset,
  isLiquidityPoolShares,
} from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import { createStellarError, toStellarError } from "../errors"
import { offlineError, onlineManager } from "../runtime/onlineManager"
import { accountKey } from "../cache/keys"
import type {
  TransactionResult,
  Asset,
  ManageOfferParams,
  NetworkConfig,
  StellarNetwork,
  WalletState,
} from "../types"

export interface ManageOfferRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  queryStore?: { invalidate: (key: readonly unknown[]) => void }
  transactionTimeout?: number
}
// Helper to convert library Asset to StellarSdk Asset
function toSdkAsset(asset: Asset): SdkAsset {
  if (isNativeAsset(asset)) return SdkAsset.native()
  if (isLiquidityPoolShares(asset)) {
    throw createStellarError("VALIDATION_ERROR", "Cannot use liquidity pool shares in offers")
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

function guard(runtime: ManageOfferRuntime): void {
  const { wallet, network } = runtime
  if (!wallet.connected || !wallet.address || !wallet.wallet)
    throw createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
  if (wallet.walletNetwork && wallet.walletNetwork !== network)
    throw createStellarError("WRONG_NETWORK", "Network mismatch")
  if (!onlineManager.isOnline()) throw offlineError()
}

/** Create (id 0), update, or cancel an offer with the shared runtime. */
export async function manageOffer(
  runtime: ManageOfferRuntime,
  params: ManageOfferParams,
  offerId = "0",
  isCancel = false
): Promise<TransactionResult> {
  guard(runtime)
  const { network, networkConfig, wallet, transactionTimeout, queryStore } = runtime
  const publicKey = wallet.address!
  let txHash = ""
  try {
    if (assetsEqual(params.selling, params.buying)) {
      throw createStellarError("VALIDATION_ERROR", "Selling and buying assets must be different")
    }

    if (!isCancel) {
      if (!isPositive(params.amount))
        throw createStellarError("VALIDATION_ERROR", "Amount must be positive")
      if (!isPositive(params.price))
        throw createStellarError("VALIDATION_ERROR", "Price must be positive")
    }

    if (isCancel && (!offerId || offerId === "0")) {
      throw createStellarError("VALIDATION_ERROR", "Missing offerId for cancellation")
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
      .setTimeout(transactionTimeout ?? DEFAULT_TRANSACTION_TIMEOUT)
      .build()

    txHash = tx.hash().toString("hex")
    const adapter = getWalletAdapter(wallet.wallet!)
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

    if (res.successful)
      queryStore?.invalidate(accountKey(networkConfig.horizonUrl, network, publicKey))
    return txResult
  } catch (caught) {
    const error = toStellarError(caught)
    if (error?.code === "TX_TIMEOUT" && txHash)
      throw createStellarError("TX_TIMEOUT", error.message, { raw: caught, hash: txHash })
    throw error ?? caught
  }
}

export function createOffer(
  runtime: ManageOfferRuntime,
  params: ManageOfferParams
): Promise<TransactionResult> {
  return manageOffer(runtime, params)
}
export async function updateOffer(
  runtime: ManageOfferRuntime,
  offerId: string,
  params: ManageOfferParams
): Promise<TransactionResult> {
  if (!offerId || offerId === "0")
    throw createStellarError("VALIDATION_ERROR", "offerId is required for updateOffer")
  return manageOffer(runtime, params, offerId)
}
export async function cancelOffer(
  runtime: ManageOfferRuntime,
  offerId: string
): Promise<TransactionResult> {
  if (!offerId || offerId === "0")
    throw createStellarError("VALIDATION_ERROR", "offerId is required for cancelOffer")
  guard(runtime)
  try {
    const server = getHorizonServer(runtime.networkConfig)
    const offer = await server.offers().offer(offerId).call()
    const selling: Asset =
      offer.selling.asset_type === "native"
        ? "XLM"
        : { code: offer.selling.asset_code!, issuer: offer.selling.asset_issuer! }
    const buying: Asset =
      offer.buying.asset_type === "native"
        ? "XLM"
        : { code: offer.buying.asset_code!, issuer: offer.buying.asset_issuer! }
    return await manageOffer(
      runtime,
      { selling, buying, amount: "0", price: offer.price_r, side: "sell" },
      offerId,
      true
    )
  } catch (caught) {
    throw toStellarError(caught) ?? caught
  }
}
