import { TransactionBuilder, Operation, StrKey } from "@stellar/stellar-sdk"
import { getHorizonServer, DEFAULT_TRANSACTION_TIMEOUT } from "../utils"
import { getWalletAdapter } from "../wallets"
import { createStellarError, isStellarError, toStellarError } from "../errors"
import { offlineError, onlineManager } from "../runtime/onlineManager"
import { accountKey } from "../cache/keys"
import type {
  CreateAccountOptions,
  TransactionResult,
  NetworkConfig,
  StellarNetwork,
  WalletState,
} from "../types"

export interface CreateAccountRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  queryStore?: { invalidate: (key: readonly unknown[]) => void }
  transactionTimeout?: number
}

/** Build, sign and submit an account-creation transaction without a UI framework. */
export async function createAccount(
  runtime: CreateAccountRuntime,
  options: CreateAccountOptions
): Promise<TransactionResult> {
  const { network, networkConfig, wallet, queryStore, transactionTimeout } = runtime
  const DEFAULT_FEE_MULTIPLIER = 1
  let txHash = ""
  try {
    if (!wallet.connected || !wallet.address || !wallet.wallet) {
      throw createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected")
    }
    if (wallet.walletNetwork && wallet.walletNetwork !== network) {
      throw createStellarError("WRONG_NETWORK", "Network mismatch")
    }
    // Fail fast offline — a signed transaction is never queued for later.
    if (!onlineManager.isOnline()) throw offlineError()

    const { destination, startingBalance, fee, feeMultiplier } = options

    // Validate destination (must be a G... address, not a C... contract)
    if (!StrKey.isValidEd25519PublicKey(destination)) {
      throw createStellarError(
        "VALIDATION_ERROR",
        "Invalid destination address. Must be a valid Ed25519 public key (starts with G)."
      )
    }

    const server = getHorizonServer(networkConfig)

    // Reject if the account already exists on the ledger
    try {
      await server.loadAccount(destination)
      // If loadAccount succeeds, the account exists.
      throw createStellarError(
        "VALIDATION_ERROR",
        "Destination account already exists on the ledger."
      )
    } catch (e: unknown) {
      // The "already exists" error above is ours — rethrow it untouched.
      // (Horizon's own failures arrive raw, so they never match this.)
      if (isStellarError(e)) throw e
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status !== 404) {
        throw e // Rethrow unrelated network errors
      }
    }

    // Fetch base reserve directly from the network's latest ledger parameters
    const ledgers = await server.ledgers().order("desc").limit(1).call()
    if (!ledgers.records || ledgers.records.length === 0) {
      throw new Error("Could not fetch the latest ledger to determine the base reserve.")
    }
    const baseReserveStroops = Number(ledgers.records[0].base_reserve_in_stroops)

    // Minimum balance for a new account is 2 * base reserve
    const minBalanceXLM = (baseReserveStroops * 2) / 10_000_000

    if (parseFloat(startingBalance) < minBalanceXLM) {
      throw createStellarError(
        "VALIDATION_ERROR",
        `Starting balance too low. The network requires a minimum of ${minBalanceXLM} XLM to create an account.`
      )
    }

    const sourceAccount = await server.loadAccount(wallet.address)

    let baseFee = parseInt(fee || "0", 10)
    if (!baseFee) {
      const feeStats = await server.feeStats()
      baseFee =
        parseInt(feeStats.last_ledger_base_fee, 10) * (feeMultiplier || DEFAULT_FEE_MULTIPLIER)
    }

    const tx = new TransactionBuilder(sourceAccount, {
      fee: baseFee.toString(),
      networkPassphrase: networkConfig.networkPassphrase,
    })
      .addOperation(
        Operation.createAccount({
          destination,
          startingBalance,
        })
      )
      .setTimeout(transactionTimeout ?? DEFAULT_TRANSACTION_TIMEOUT)
      .build()

    const adapter = getWalletAdapter(wallet.wallet)
    if (!adapter) {
      throw createStellarError("WALLET_UNSUPPORTED", `Wallet adapter not found: ${wallet.wallet}`)
    }

    txHash = tx.hash().toString("hex")

    const signedXdr = await adapter.signTransaction(tx.toXDR(), {
      address: wallet.address,
      network: networkConfig.network,
      networkPassphrase: networkConfig.networkPassphrase,
    })
    const signedTx = TransactionBuilder.fromXDR(signedXdr, networkConfig.networkPassphrase)

    const res = await server.submitTransaction(signedTx)

    const txResult: TransactionResult = {
      hash: res.hash,
      status: res.successful ? "success" : "failed",
      ledger: res.ledger,
    }

    if (res.successful) {
      queryStore?.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))
      queryStore?.invalidate(accountKey(networkConfig.horizonUrl, network, destination))
    }
    return txResult
  } catch (caught) {
    const error = toStellarError(caught)
    if (error?.code === "TX_TIMEOUT" && txHash) {
      throw createStellarError("TX_TIMEOUT", error.message, { raw: caught, hash: txHash })
    }
    throw error ?? caught
  }
}
