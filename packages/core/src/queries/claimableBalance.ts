/* eslint-disable */
import { getHorizonServer } from "../utils"
import { toStellarError } from "../errors"
import { claimableBalanceKey } from "../cache/keys"
import type { ClaimableBalance, NetworkConfig } from "../types"

export { claimableBalanceKey }

export async function fetchClaimableBalance(
  networkConfig: NetworkConfig,
  params: { address: string },
  options: { signal?: AbortSignal } = {}
): Promise<ClaimableBalance[]> {
  const { address } = params
  try {
    const server = getHorizonServer(networkConfig)
    const result = await server.claimableBalances().claimant(address).call()
    return result.records.map(record => ({
      id: record.id,
      asset: record.asset,
      amount: record.amount,
      claimants: record.claimants.map(c => ({
        destination: c.destination,
        predicate: c.predicate as object,
      })),
      sponsor: record.sponsor,
    }))
  } catch (err) {
    if (options.signal?.aborted) throw err
    const stellarError = toStellarError(err)
    // A 404 means the account has no claimable balances — treat as empty
    if (stellarError?.code === "ACCOUNT_NOT_FOUND") {
      return []
    }
    throw stellarError ?? err
  }
}
