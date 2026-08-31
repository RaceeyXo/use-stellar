import type { Horizon } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import type { FeeOptions } from "../types"

/**
 * Multiplier applied to the network's current base fee when the caller does
 * not choose one.
 *
 * **Why 10, and why that is not extravagant.** A Stellar fee is a *maximum
 * bid*, not a charge: the network only ever takes what it needs to include the
 * transaction in a ledger. On an uncongested ledger a 10x bid still costs the
 * base fee — 100 stroops, or 0.00001 XLM. During surge pricing that same bid
 * is what keeps the transaction landing instead of coming back as
 * `tx_insufficient_fee`.
 *
 * So the asymmetry is stark. Bidding low saves nothing measurable and fails
 * under load; bidding high costs nothing measurable and survives it. 10x is a
 * deliberate default on the safe side of that trade.
 *
 * Override it per call with `feeMultiplier`, or bypass it entirely with `fee`.
 */
export const DEFAULT_FEE_MULTIPLIER = 10

/** The subset of the Horizon server this module needs. */
interface FeeSource {
  fetchBaseFee: () => Promise<number>
}

/**
 * Resolves the fee (in stroops, per operation) a transaction should bid.
 *
 * Precedence, most specific first:
 *  1. An explicit `fee` — used verbatim, no multiplier applied.
 *  2. `feeMultiplier` x the base fee fetched from Horizon.
 *  3. {@link DEFAULT_FEE_MULTIPLIER} x the base fee fetched from Horizon.
 *
 * There is deliberately no fallback to the SDK's `BASE_FEE` constant. That
 * constant is the network *minimum* — the floor of the auction, not a bid — so
 * falling back to it during the exact conditions that make `fetchBaseFee()`
 * fail would submit the least competitive transaction possible at the worst
 * moment. A failed fetch surfaces as an error instead.
 *
 * @throws {StellarError} `VALIDATION_ERROR` for a malformed `fee` or
 *         `feeMultiplier`, or `NETWORK_ERROR` when the base fee cannot be
 *         fetched.
 */
export async function resolveFee(server: FeeSource, options: FeeOptions = {}): Promise<string> {
  const { fee, feeMultiplier } = options

  if (fee !== undefined) {
    if (typeof fee !== "string" || !/^\d+$/.test(fee.trim()) || fee.trim() === "0") {
      throw createStellarError(
        "VALIDATION_ERROR",
        `Invalid fee ${JSON.stringify(fee)}. Pass a positive integer string of stroops, e.g. "10000".`
      )
    }
    return fee.trim()
  }

  if (feeMultiplier !== undefined) {
    if (
      typeof feeMultiplier !== "number" ||
      !Number.isFinite(feeMultiplier) ||
      feeMultiplier <= 0
    ) {
      throw createStellarError(
        "VALIDATION_ERROR",
        `Invalid feeMultiplier ${JSON.stringify(feeMultiplier)}. Pass a positive number, e.g. 10.`
      )
    }
  }

  const multiplier = feeMultiplier ?? DEFAULT_FEE_MULTIPLIER

  let baseFee: number
  try {
    baseFee = await server.fetchBaseFee()
  } catch (err) {
    // Surfaced, never swallowed: bidding the network minimum because we could
    // not read the current one is how a transaction fails under congestion
    // with nothing to explain why.
    const cause = toStellarError(err)
    const causeMessage = cause?.message ?? "Unknown error"
    throw createStellarError(
      "NETWORK_ERROR",
      "Could not fetch the current network base fee, so no fee could be chosen. " +
        `Pass an explicit \`fee\` to proceed without Horizon. (${causeMessage})`,
      { raw: err }
    )
  }

  if (!Number.isFinite(baseFee) || baseFee <= 0) {
    throw createStellarError(
      "NETWORK_ERROR",
      `Horizon returned an unusable base fee (${String(baseFee)}). Pass an explicit \`fee\` to proceed.`
    )
  }

  return String(Math.ceil(baseFee * multiplier))
}

/** Narrows a Horizon server to the fee-fetching surface this module uses. */
export function asFeeSource(server: Horizon.Server): FeeSource {
  return server as unknown as FeeSource
}
