import { useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import {
  createOffer as createOfferAction,
  updateOffer as updateOfferAction,
  cancelOffer as cancelOfferAction,
} from "../actions/manageOffer"
import { toStellarError, type StellarError } from "../errors"
import type { TransactionResult, ManageOfferParams, UseManageOfferReturn } from "../types"

export function useManageOffer(): UseManageOfferReturn {
  const runtime = useStellarContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [result, setResult] = useState<TransactionResult | null>(null)
  async function perform(
    action: () => Promise<TransactionResult>
  ): Promise<TransactionResult | null> {
    setLoading(true)
    setError(null)
    try {
      const outcome = await action()
      setResult(outcome)
      return outcome
    } catch (caught) {
      const failure = toStellarError(caught)
      setError(failure)
      if (failure?.code === "TX_TIMEOUT") setResult({ hash: failure.hash ?? "", status: "pending" })
      return null
    } finally {
      setLoading(false)
    }
  }
  const createOffer = (params: ManageOfferParams) =>
    perform(() => createOfferAction(runtime, params))
  const updateOffer = (offerId: string, params: ManageOfferParams) =>
    perform(() => updateOfferAction(runtime, offerId, params))
  const cancelOffer = (offerId: string) => perform(() => cancelOfferAction(runtime, offerId))
  const reset = () => {
    setError(null)
    setResult(null)
    setLoading(false)
  }
  return { createOffer, updateOffer, cancelOffer, loading, error, result, reset }
}
