// packages/core/src/hooks/useSorobanWrite.ts

import { useState, useCallback } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { getHorizonServer, isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"
import { rpc, Contract, TransactionBuilder, scValToNative, Account } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import type { SorobanInvokeOptions, UseSorobanWriteReturn } from "../types"
import type { StellarError } from "../errors"

export function useSorobanWrite<T = unknown>(): UseSorobanWriteReturn<T> {
  const { network, networkConfig, wallet } = useStellarContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<{ hash: string; result: T } | null>(null)

  const invoke = useCallback(
    async (options: SorobanInvokeOptions) => {
      setLoading(true)
      setError(null)
      setResult(null)

      try {
        if (!isBrowser()) {
          throw createStellarError(
            "VALIDATION_ERROR",
            "Contract invocation is only available in the browser. " +
              'Move your component to a "use client" boundary in Next.js / Remix.'
          )
        }
        if (!wallet.connected || !wallet.address || !wallet.wallet) {
          throw createStellarError(
            "WALLET_NOT_CONNECTED",
            "Wallet not connected. Call connect() first."
          )
        }
        if (wallet.walletNetwork && wallet.walletNetwork !== network) {
          throw createStellarError(
            "WRONG_NETWORK",
            `Wallet is on ${wallet.walletNetwork}, but the provider is on ${network}.`
          )
        }

        const { contractId, method, args = [], fee, timeout = 30000 } = options

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
          throw createStellarError(
            "SIMULATION_FAILED",
            "Simulation failed for an unknown reason.",
            { raw: simResult }
          )
        }

        // 3. Assemble: applies footprint and merges the simulation's minResourceFee
        const assembledTx = rpc.assembleTransaction(tx, simResult).build()

        const adapter = getWalletAdapter(wallet.wallet)
        if (!adapter) {
          throw createStellarError(
            "WALLET_UNSUPPORTED",
            `Wallet adapter not found: ${wallet.wallet}`
          )
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

          await new Promise(resolve => setTimeout(resolve, 2000))
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

        const finalResult = {
          hash: txHash,
          result: decodedResult as T,
        }

        setResult(finalResult)
        return finalResult
      } catch (err: unknown) {
        // toStellarError returns null for deliberate cancellations (AbortError);
        // those must not be reported as a failure, but the caller still unwinds.
        const stellarError = toStellarError(err)
        if (!stellarError) throw err
        setError(stellarError)
        throw stellarError
      } finally {
        setLoading(false)
      }
    },
    [network, networkConfig, wallet]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setResult(null)
  }, [])

  return {
    invoke,
    loading,
    error,
    result,
    reset,
  }
}
