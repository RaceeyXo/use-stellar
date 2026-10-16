import { TransactionBuilder, Operation, Asset as StellarAsset, Memo } from "@stellar/stellar-sdk"
import { getHorizonServer, isNativeAsset, isIssuedAsset, canSignTransactions } from "../utils"
import { asFeeSource, resolveFee } from "../utils/fees"
import { getWalletAdapter } from "../wallets"
import {
  createStellarError,
  toStellarError,
  toSubmissionError,
  StellarError as StellarErrorClass,
} from "../errors"
import { accountKey } from "../cache"
import type {
  SendPaymentOptions,
  SendPaymentResult,
  Asset,
  MemoInput,
  NetworkConfig,
  StellarNetwork,
  WalletState,
} from "../types"

/**
 * The narrow view of the runtime {@link sendPayment} needs: network
 * configuration, the connected wallet state, and the shared query store for
 * cache invalidation. A full `StellarContextValue` satisfies this.
 */
export interface SendPaymentRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  queryStore: { invalidate: (key: readonly unknown[]) => void }
}

/**
 * Thrown by {@link sendPayment} in place of the original hook's non-throwing
 * abort return (`{ hash: "", status: "failed", error: "Request was cancelled" }`).
 *
 * The action always throws on any non-success path so the framework adapter
 * has one control-flow shape to drive its state from; this class is a marker
 * — not a new `StellarErrorCode` — that lets the adapter recognise the
 * deliberate-cancellation case specifically and reproduce the hook's original
 * non-error return, rather than surfacing it as `error` state.
 */
export class SendPaymentAbortedError extends Error {
  constructor() {
    super("Request was cancelled")
    this.name = "SendPaymentAbortedError"
    Object.setPrototypeOf(this, SendPaymentAbortedError.prototype)
  }
}

/** Marks an error as a pre-flight guard failure — see {@link isPreflightError}. */
function markPreflight<E extends object>(error: E): E {
  return Object.assign(error, { isPreflightError: true as const })
}

/**
 * True for an error thrown by one of {@link sendPayment}'s pre-flight guards
 * (wallet not connected, no adapter selected, non-browser environment, wrong
 * network) — thrown before any transaction work begins. The original hook
 * never touched `error`/`result` state for these; adapters use this to
 * reproduce that.
 */
export function isPreflightError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { isPreflightError?: boolean }).isPreflightError
  )
}

/**
 * Builds the SDK memo for a {@link MemoInput}.
 *
 * A bare string stays a text memo, which is what it always meant. The tagged
 * forms exist because the type matters on the wire: an exchange that asks for
 * an id memo will not credit a text memo containing the same digits.
 */
function buildMemo(memo: MemoInput): Memo {
  if (typeof memo === "string") return Memo.text(memo)

  switch (memo.type) {
    case "text":
      return Memo.text(memo.value)
    case "id":
      return Memo.id(memo.value)
    case "hash":
      return Memo.hash(memo.value)
    case "return":
      return Memo.return(memo.value)
    default: {
      // Exhaustive: a new MemoInput variant fails to compile here.
      const unreachable: never = memo
      throw createStellarError("INVALID_MEMO", `Unsupported memo: ${JSON.stringify(unreachable)}.`)
    }
  }
}

function toStellarAsset(asset: Asset): StellarAsset {
  if (isNativeAsset(asset)) return StellarAsset.native()
  if (isIssuedAsset(asset)) return new StellarAsset(asset.code, asset.issuer)
  throw createStellarError(
    "VALIDATION_ERROR",
    `Unsupported asset: ${JSON.stringify(asset)}. ` + `Pass "XLM" or { code, issuer }.`
  )
}

/**
 * Builds, signs, and submits a payment transaction to the Stellar network.
 *
 * Framework-neutral extraction of `useSendPayment`'s `send` callback. Preserves
 * verbatim: validation, fee resolution (`fee` > `feeMultiplier` > default),
 * memo handling, transaction construction, `setTimeout(30)`, wallet signing
 * against the runtime's resolved `networkPassphrase`, Horizon submission, 504
 * handling, `.xdr` behaviour, and account-cache invalidation on success only.
 *
 * On failure this always throws rather than returning a `status: "failed"`
 * result, so the framework adapter can drive its own `result`/`error` state
 * from a single control-flow path:
 * - Validation / wallet-guard failures throw a {@link StellarError} directly
 *   (`WALLET_NOT_CONNECTED`, `VALIDATION_ERROR`, `WRONG_NETWORK`).
 * - A submission failure throws the mapped submission error, which carries
 *   `.hash` (via `toSubmissionError`) so the adapter can still record the
 *   attempted hash before surfacing the error.
 * - A 504 throws a `TX_TIMEOUT` `StellarError` whose `.hash` is the
 *   pre-computed transaction hash, exactly as before.
 * - A deliberate abort (an underlying `toStellarError` returning `null`)
 *   throws {@link SendPaymentAbortedError}, so the adapter can special-case it
 *   exactly as the hook did (a cancelled send is not surfaced as `error`
 *   state).
 *
 * @throws {StellarError | SendPaymentAbortedError} always, on any non-success
 *         path — see above.
 */
export async function sendPayment(
  runtime: SendPaymentRuntime,
  options: SendPaymentOptions
): Promise<SendPaymentResult> {
  const { network, networkConfig, wallet, queryStore } = runtime

  // Pre-flight guards, thrown before any state would be touched — marked so
  // the adapter can reproduce the original hook's behaviour of never calling
  // setError/setResult for these (the thrown object is the only signal).
  if (!wallet.connected || !wallet.address) {
    throw markPreflight(
      createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
    )
  }
  if (!wallet.wallet) {
    throw markPreflight(new Error("No wallet adapter selected. Call connect() first."))
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

  // Check for network mismatch
  if (wallet.walletNetwork && wallet.network !== wallet.walletNetwork) {
    throw markPreflight(
      createStellarError(
        "WRONG_NETWORK",
        `Network mismatch: Provider is on ${wallet.network} but wallet is on ${wallet.walletNetwork}. ` +
          `Switch your wallet to ${wallet.network} or call refreshWalletNetwork() to update.`
      )
    )
  }

  let txHash = ""

  try {
    const stellarAsset = toStellarAsset(options.asset)
    const server = getHorizonServer(networkConfig)
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
      builder.addMemo(buildMemo(options.memo))
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
      const submissionError = toSubmissionError(res)
      // A marker (not a new StellarErrorCode) letting the caller distinguish
      // "Horizon returned an unsuccessful result" from any other rejection
      // (network error, thrown exception) — the original hook only records a
      // `status: "failed"` result for this specific case.
      Object.assign(submissionError, { isSubmissionFailure: true })
      throw submissionError
    }

    const outcome: SendPaymentResult = {
      hash: res.hash,
      status: "success",
    }

    // Invalidate the sender's account/balance cache so any mounted hook
    // sees fresh data on the next render cycle.
    if (wallet.address) {
      queryStore.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))
    }

    return outcome
  } catch (err) {
    const stellarError = toStellarError(err)

    // If toStellarError returns null, it was an abort (deliberate cancellation).
    if (!stellarError) {
      throw new SendPaymentAbortedError()
    }

    // On TX_TIMEOUT (504), we have the hash but don't know the outcome yet.
    // Attach it so the caller can poll useTransaction(hash).
    if (stellarError.code === "TX_TIMEOUT") {
      const errorWithHash = new StellarErrorClass(stellarError.code, stellarError.message, {
        raw: stellarError.raw,
        hash: txHash,
      })
      throw errorWithHash
    }

    throw stellarError
  }
}
