import { rpc, Contract, TransactionBuilder, scValToNative, Account } from "@stellar/stellar-sdk"
import { getHorizonServer, isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"
import { createStellarError } from "../errors"
import { isValidContractId } from "../queries/soroban"
import { offlineError, onlineManager } from "../runtime/onlineManager"
// From the module itself, not the "../cache" index, which re-exports the React `useQuery`.
import { accountKey } from "../cache/keys"
import type { NetworkConfig, SorobanInvokeOptions, StellarNetwork, WalletState } from "../types"

/** Default poll budget, in milliseconds, before a submitted call surfaces `TX_TIMEOUT`. */
export const DEFAULT_SOROBAN_WRITE_TIMEOUT = 30000
/** Delay between `getTransaction` polls while the transaction is not yet in a ledger. */
export const SOROBAN_WRITE_POLL_INTERVAL = 2000

/** The narrow view of the runtime {@link invokeContract} needs. */
export interface SorobanWriteRuntime {
  network: StellarNetwork
  networkConfig: NetworkConfig
  wallet: WalletState
  /** When given, the signer's account queries are invalidated after a successful call. */
  queryStore?: { invalidate: (key: readonly unknown[]) => void }
}

export interface SorobanWriteResult<T = unknown> {
  hash: string
  result: T
}

/**
 * Invokes a Soroban contract method that changes state: simulate → assemble →
 * sign → send → poll.
 *
 * Framework-neutral extraction of `useSorobanWrite`'s `invoke` callback, so the
 * React hook and the Vue composable share one implementation. Every failure is
 * thrown as a `StellarError`, with the same codes the hook always used:
 * - `VALIDATION_ERROR` outside a browser, `WALLET_NOT_CONNECTED`,
 *   `WRONG_NETWORK`, `NETWORK_ERROR` when offline, `WALLET_UNSUPPORTED`;
 * - `SIMULATION_FAILED` and `RESTORE_PREAMBLE_REQUIRED` from simulation;
 * - `TRANSACTION_FAILED` (with `.hash` when one exists) for a rejected send or
 *   an on-chain failure;
 * - `TX_TIMEOUT` with `.hash` when polling gives up — the transaction may still
 *   succeed, so the caller should treat it as pending.
 *
 * Errors from the wallet (a rejected signature) and the network are rethrown
 * as they come; the adapter maps them with `toStellarError`, which also tells a
 * deliberate abort apart from a failure.
 */
export async function invokeContract<T = unknown>(
  runtime: SorobanWriteRuntime,
  options: SorobanInvokeOptions
): Promise<SorobanWriteResult<T>> {
  const { network, networkConfig, wallet, queryStore } = runtime

  if (!isBrowser()) {
    throw createStellarError(
      "VALIDATION_ERROR",
      "Contract invocation is only available in the browser. " +
        'Move your component to a "use client" boundary in Next.js / Remix.'
    )
  }
  if (!wallet.connected || !wallet.address || !wallet.wallet) {
    throw createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected. Call connect() first.")
  }
  if (wallet.walletNetwork && wallet.walletNetwork !== network) {
    throw createStellarError(
      "WRONG_NETWORK",
      `Wallet is on ${wallet.walletNetwork}, but the provider is on ${network}.`
    )
  }
  // Fail fast offline — a signed transaction is never queued for later.
  if (!onlineManager.isOnline()) throw offlineError()

  const { contractId, method, args = [], fee, timeout = DEFAULT_SOROBAN_WRITE_TIMEOUT } = options
  // The same check the read path (`simulateContractCall`) applies, before any network work.
  if (!isValidContractId(contractId)) {
    throw createStellarError(
      "VALIDATION_ERROR",
      `Invalid contract ID "${contractId}". Must be a C-prefixed 56-character Stellar address.`
    )
  }

  const server = new rpc.Server(networkConfig.sorobanUrl)
  const horizon = getHorizonServer(networkConfig)

  const accountInfo = await horizon.loadAccount(wallet.address)
  const account = new Account(wallet.address, accountInfo.sequence)

  const contract = new Contract(contractId)

  // 1. Build initial tx for simulation
  const tx = new TransactionBuilder(account, {
    fee: fee || "100", // Inclusion fee
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(Math.floor(timeout / 1000) || 30)
    .build()

  // 2. Simulate transaction
  const simResult = await server.simulateTransaction(tx)

  if (rpc.Api.isSimulationError(simResult)) {
    throw createStellarError("SIMULATION_FAILED", simResult.error, { raw: simResult })
  }

  if (rpc.Api.isSimulationRestore(simResult)) {
    throw createStellarError("RESTORE_PREAMBLE_REQUIRED", undefined, { raw: simResult })
  }

  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw createStellarError("SIMULATION_FAILED", "Simulation failed for an unknown reason.", {
      raw: simResult,
    })
  }

  // 3. Assemble: applies footprint and merges the simulation's minResourceFee
  const assembledTx = rpc.assembleTransaction(tx, simResult).build()

  const adapter = getWalletAdapter(wallet.wallet)
  if (!adapter) {
    throw createStellarError("WALLET_UNSUPPORTED", `Wallet adapter not found: ${wallet.wallet}`)
  }

  // 4. Sign
  const signedXdr = await adapter.signTransaction(assembledTx.toXDR(), {
    address: wallet.address,
    network: networkConfig.network,
    networkPassphrase: networkConfig.networkPassphrase,
  })
  const signedTx = TransactionBuilder.fromXDR(signedXdr, networkConfig.networkPassphrase)

  // 5. Send & Poll
  const sendResult = await server.sendTransaction(signedTx)

  if (sendResult.errorResult) {
    throw createStellarError(
      "TRANSACTION_FAILED",
      `Transaction submission failed: ${sendResult.errorResult.result().switch().name}`,
      { raw: sendResult, hash: sendResult.hash }
    )
  }

  const txHash = sendResult.hash
  const startTime = Date.now()
  let txStatus: rpc.Api.GetTransactionResponse

  for (;;) {
    if (Date.now() - startTime > timeout) {
      throw createStellarError(
        "TX_TIMEOUT",
        `Transaction polling timed out after ${timeout}ms. The transaction may still ` +
          `succeed — poll ${txHash} to determine the outcome.`,
        { hash: txHash }
      )
    }

    txStatus = await server.getTransaction(txHash)

    // NOT_FOUND is how the RPC reports "not yet in a ledger"; there is no
    // PENDING member on this enum. Anything else is a settled outcome.
    if (txStatus.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      break
    }

    await new Promise(resolve => setTimeout(resolve, SOROBAN_WRITE_POLL_INTERVAL))
  }

  if (txStatus.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw createStellarError(
      "TRANSACTION_FAILED",
      `Transaction failed on-chain: ${txStatus.resultXdr}`,
      { raw: txStatus, hash: txHash }
    )
  }

  let decodedResult: unknown
  const returnValue = (txStatus as rpc.Api.GetSuccessfulTransactionResponse).returnValue

  if (returnValue) {
    try {
      decodedResult = scValToNative(returnValue)
    } catch {
      decodedResult = returnValue // Fallback to raw XDR
    }
  }

  // The call paid fees from the signer, and may have moved its balances.
  queryStore?.invalidate(accountKey(networkConfig.horizonUrl, network, wallet.address))

  return { hash: txHash, result: decodedResult as T }
}
