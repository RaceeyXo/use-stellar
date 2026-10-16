import { TransactionBuilder, Operation, Asset as StellarAsset } from "@stellar/stellar-sdk"
import { getHorizonServer, canSignTransactions, isIssuedAsset } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import { createStellarError, toStellarError, toSubmissionError } from "../errors"
import { accountKey } from "../cache"
import type {
  AddTrustlineOptions,
  TransactionResult,
  NetworkConfig,
  StellarNetwork,
  WalletState,
} from "../types"

/** The narrow view of the runtime {@link addTrustline} needs. */
export interface AddTrustlineRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  queryStore: { invalidate: (key: readonly unknown[]) => void }
}

/**
 * Thrown by {@link addTrustline} in place of the original hook's non-throwing
 * abort return (`{ hash: "", status: "failed" }`). See
 * {@link ../actions/sendPayment.SendPaymentAbortedError} for the identical
 * rationale.
 */
export class AddTrustlineAbortedError extends Error {
  constructor() {
    super("Request was cancelled")
    this.name = "AddTrustlineAbortedError"
    Object.setPrototypeOf(this, AddTrustlineAbortedError.prototype)
  }
}

/** Marks an error as a pre-flight guard failure — see {@link isPreflightError}. */
function markPreflight<E extends object>(error: E): E {
  return Object.assign(error, { isPreflightError: true as const })
}

/**
 * True for an error thrown by one of {@link addTrustline}'s pre-flight guards,
 * thrown before any transaction work begins. The original hook never touched
 * `error`/`result` state for these; adapters use this to reproduce that.
 */
export function isPreflightError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { isPreflightError?: boolean }).isPreflightError
  )
}

/**
 * Builds, signs, and submits a `changeTrust` transaction to establish a
 * trustline for an asset, allowing an account to hold it.
 *
 * Framework-neutral extraction of `useAddTrustline`'s `addTrustline` callback.
 * Preserves verbatim: validation, fee resolution, transaction construction,
 * `setTimeout(30)`, wallet signing against the runtime's resolved
 * `networkPassphrase`, Horizon submission, 504 handling, and account-cache
 * invalidation on success only. See `sendPayment`'s doc comment for the exact
 * error-throwing contract this mirrors (`isPreflightError`, submission-failure
 * marker, `TX_TIMEOUT` hash, abort marker class).
 *
 * @throws {StellarError | AddTrustlineAbortedError} always, on any non-success path.
 */
export async function addTrustline(
  runtime: AddTrustlineRuntime,
  options: AddTrustlineOptions
): Promise<TransactionResult> {
  const { network, networkConfig, wallet, queryStore } = runtime

  if (!wallet.connected || !wallet.address) {
    throw markPreflight(
      createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
    )
  }
  if (!wallet.wallet) {
    throw markPreflight(createStellarError("WALLET_NOT_CONNECTED", "No wallet adapter selected."))
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

  if (!isIssuedAsset(options.asset)) {
    throw markPreflight(
      createStellarError(
        "VALIDATION_ERROR",
        "Invalid asset. Trustlines can only be created for issued assets, not XLM."
      )
    )
  }

  let txHash = ""

  try {
    const stellarAsset = new StellarAsset(options.asset.code, options.asset.issuer)
    const server = getHorizonServer(networkConfig)
    const sourceAcc = await server.loadAccount(wallet.address)
    // Resolved once by the provider, so a signature can never be bound to
    // a network the caller did not configure.
    const { networkPassphrase } = networkConfig
    const fee = await resolveFee(asFeeSource(server), options)

    const operation = Operation.changeTrust({
      asset: stellarAsset,
      limit: options.limit,
    })

    const tx = new TransactionBuilder(sourceAcc, { fee, networkPassphrase })
      .addOperation(operation)
      .setTimeout(30)
      .build()

    // Compute the transaction hash BEFORE submission so it is available
    // even if Horizon times out (504).
    txHash = tx.hash().toString("hex")

    const adapter = getWalletAdapter(wallet.wallet)
    const signedTxXdr = await adapter.signTransaction(tx.toXDR(), {
      address: wallet.address,
      network,
      networkPassphrase,
    })
    const signed = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase)
    const res = await server.submitTransaction(signed)

    if (!res.successful) {
      const submissionError = toSubmissionError(res)
      Object.assign(submissionError, { isSubmissionFailure: true, hash: res.hash })
      throw submissionError
    }

    const outcome: TransactionResult = { hash: res.hash, status: "success" }

    // Invalidate the sender's account/balance cache — a new trustline
    // changes the account's subentry count and balance list.
    if (wallet.address) {
      queryStore.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))
    }

    return outcome
  } catch (err) {
    const stellarError = toStellarError(err)

    // If toStellarError returns null, it was an abort (deliberate cancellation).
    if (!stellarError) {
      throw new AddTrustlineAbortedError()
    }

    // On TX_TIMEOUT (504), we have the hash but don't know the outcome yet.
    if (stellarError.code === "TX_TIMEOUT") {
      const errorWithHash = Object.assign(toStellarErrorWithHash(stellarError, txHash))
      throw errorWithHash
    }

    throw stellarError
  }
}

/** Rebuilds a StellarError with `.hash` attached, preserving code/message/raw. */
function toStellarErrorWithHash<T extends { code: string; message: string; raw?: unknown }>(
  error: T,
  hash: string
): T & { hash: string } {
  return Object.assign(error, { hash })
}
