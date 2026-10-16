import { Asset as StellarAsset, Memo, Operation, TransactionBuilder } from "@stellar/stellar-sdk"
import { accountKey } from "../cache"
import { createStellarError, toStellarError } from "../errors"
import { getHorizonServer, canSignTransactions, isIssuedAsset, isNativeAsset } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import type {
  Asset,
  NetworkConfig,
  PathPaymentOptions,
  StellarError,
  StellarNetwork,
  TransactionResult,
  WalletState,
} from "../types"

const SLIPPAGE_RESULT_CODES = ["op_under_dest_min", "op_over_source_max"] as const

export interface PathPaymentRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  queryStore: { invalidate: (key: readonly unknown[]) => void }
}

function markPreflight<E extends object>(error: E): E {
  return Object.assign(error, { isPreflightError: true as const })
}

export function isPathPaymentPreflightError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { isPreflightError?: boolean }).isPreflightError
  )
}

function toStellarAsset(asset: Asset, field: string): StellarAsset {
  if (isNativeAsset(asset)) return StellarAsset.native()
  if (isIssuedAsset(asset)) {
    if (!asset.code || !asset.issuer) {
      throw createStellarError(
        "VALIDATION_ERROR",
        `usePathPayment: \`${field}\` needs both \`code\` and \`issuer\`.`
      )
    }
    return new StellarAsset(asset.code, asset.issuer)
  }

  throw createStellarError(
    "VALIDATION_ERROR",
    `usePathPayment: \`${field}\` is not a supported asset. Pass "XLM" or { code, issuer }.`
  )
}

function getOperationResultCodes(error: unknown): string[] {
  if (!error || typeof error !== "object" || !("response" in error)) return []
  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== "object") return []
  const data = (response as { data?: unknown }).data
  if (!data || typeof data !== "object") return []
  const extras = (data as { extras?: unknown }).extras
  if (!extras || typeof extras !== "object") return []
  const resultCodes = (extras as { result_codes?: unknown }).result_codes
  if (!resultCodes || typeof resultCodes !== "object") return []
  const operations = (resultCodes as { operations?: unknown }).operations
  return Array.isArray(operations)
    ? operations.filter((operation): operation is string => typeof operation === "string")
    : []
}

function toPathPaymentError(error: unknown, mode: PathPaymentOptions["mode"]): StellarError {
  const slippage = SLIPPAGE_RESULT_CODES.find(code => getOperationResultCodes(error).includes(code))
  if (slippage) {
    const bound = mode === "strictSend" ? "destMin" : "sendMax"
    return createStellarError(
      "TRANSACTION_FAILED",
      `The rate moved past your slippage bound (${slippage}). ` +
        `Re-fetch the path with usePaymentPaths, recompute \`${bound}\`, and submit again.`,
      { raw: error }
    )
  }

  return (
    toStellarError(error) ??
    createStellarError("UNKNOWN", "An unknown error occurred", { raw: error })
  )
}

function assertValidOptions(options: PathPaymentOptions): void {
  if (!options || typeof options !== "object") {
    throw markPreflight(
      createStellarError("VALIDATION_ERROR", "usePathPayment: options are required.")
    )
  }
  if (!options.destination) {
    throw markPreflight(
      createStellarError("VALIDATION_ERROR", "usePathPayment: `destination` is required.")
    )
  }

  if (options.mode === "strictSend") {
    if (!options.sendAmount) {
      throw markPreflight(
        createStellarError(
          "VALIDATION_ERROR",
          'usePathPayment: "strictSend" requires `sendAmount`.'
        )
      )
    }
    if (!options.destMin) {
      throw markPreflight(
        createStellarError(
          "VALIDATION_ERROR",
          'usePathPayment: "strictSend" requires `destMin`, the least the recipient will accept. ' +
            "There is no default - a permissive bound authorises the network to give the recipient nothing."
        )
      )
    }
    return
  }

  if (options.mode === "strictReceive") {
    if (!options.destAmount) {
      throw markPreflight(
        createStellarError(
          "VALIDATION_ERROR",
          'usePathPayment: "strictReceive" requires `destAmount`.'
        )
      )
    }
    if (!options.sendMax) {
      throw markPreflight(
        createStellarError(
          "VALIDATION_ERROR",
          'usePathPayment: "strictReceive" requires `sendMax`, the most you will spend. ' +
            "There is no default - an unbounded maximum authorises the network to spend everything."
        )
      )
    }
    return
  }

  throw markPreflight(
    createStellarError(
      "VALIDATION_ERROR",
      `usePathPayment: unknown mode ${JSON.stringify((options as { mode?: unknown }).mode)}. ` +
        'Use "strictSend" or "strictReceive".'
    )
  )
}

/** Builds, signs, submits, and invalidates cache for one bounded path payment. */
export async function pathPayment(
  runtime: PathPaymentRuntime,
  options: PathPaymentOptions
): Promise<TransactionResult> {
  const { network, networkConfig, wallet, queryStore } = runtime

  if (!wallet.connected || !wallet.address) {
    throw markPreflight(
      createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
    )
  }
  if (!wallet.wallet) {
    throw markPreflight(
      createStellarError(
        "WALLET_NOT_CONNECTED",
        "No wallet adapter selected. Call connect() first."
      )
    )
  }
  if (!canSignTransactions()) {
    throw markPreflight(
      createStellarError(
        "VALIDATION_ERROR",
        "Transaction signing is only available in the browser or React Native. " +
          'Move your component to a "use client" boundary in Next.js / Remix.'
      )
    )
  }
  if (wallet.walletNetwork && wallet.network !== wallet.walletNetwork) {
    throw markPreflight(
      createStellarError(
        "WRONG_NETWORK",
        `Network mismatch: Provider is on ${wallet.network} but wallet is on ${wallet.walletNetwork}. ` +
          `Switch your wallet to ${wallet.network} or call refreshWalletNetwork() to update.`
      )
    )
  }
  assertValidOptions(options)

  try {
    const server = getHorizonServer(networkConfig)
    const sourceAccount = await server.loadAccount(wallet.address)
    const { networkPassphrase } = networkConfig
    const fee = await resolveFee(asFeeSource(server), options)
    const sendAsset = toStellarAsset(options.sendAsset, "sendAsset")
    const destAsset = toStellarAsset(options.destAsset, "destAsset")
    const path = (options.path ?? []).map((asset, index) => toStellarAsset(asset, `path[${index}]`))

    const operation =
      options.mode === "strictSend"
        ? Operation.pathPaymentStrictSend({
            destination: options.destination,
            sendAsset,
            sendAmount: options.sendAmount,
            destAsset,
            destMin: options.destMin,
            path,
          })
        : Operation.pathPaymentStrictReceive({
            destination: options.destination,
            sendAsset,
            sendMax: options.sendMax,
            destAsset,
            destAmount: options.destAmount,
            path,
          })

    const builder = new TransactionBuilder(sourceAccount, { fee, networkPassphrase }).addOperation(
      operation
    )
    if (options.memo) builder.addMemo(Memo.text(options.memo))
    const transaction = builder.setTimeout(30).build()

    const adapter = getWalletAdapter(wallet.wallet)
    const signedXdr = await adapter.signTransaction(transaction.toXDR(), {
      address: wallet.address,
      network,
      networkPassphrase,
    })
    const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
    const response = await server.submitTransaction(signed)
    const outcome: TransactionResult = {
      hash: response.hash,
      status: response.successful ? "success" : "failed",
      ledger: response.ledger,
      envelope: response.envelope_xdr,
    }

    queryStore.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))
    return outcome
  } catch (error) {
    throw toPathPaymentError(error, options.mode)
  }
}
