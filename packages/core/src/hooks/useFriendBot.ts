// packages/core/src/hooks/useFriendbot.ts

import { useState, useCallback, useRef, useEffect } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { StrKey } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import type { UseFriendbotReturn } from "../types"
import type { StellarError } from "../errors"

export function useFriendbot(): UseFriendbotReturn {
  const { network, wallet } = useStellarContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const [funded, setFunded] = useState(false)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fund = useCallback(
    async (address?: string) => {
      setLoading(true)
      setError(null)
      setFunded(false)

      try {
        if (network === "mainnet") {
          throw createStellarError("VALIDATION_ERROR", "Friendbot is not available on mainnet.")
        }

        const targetAddress = address ?? wallet.address
        if (!targetAddress) {
          throw createStellarError(
            "WALLET_NOT_CONNECTED",
            "No address provided and wallet is not connected."
          )
        }

        if (!StrKey.isValidEd25519PublicKey(targetAddress)) {
          throw createStellarError(
            "VALIDATION_ERROR",
            "Invalid destination address. Must be a valid Ed25519 public key (starts with G)."
          )
        }

        let friendbotUrl = ""
        if (network === "testnet") {
          friendbotUrl = "https://friendbot.stellar.org"
        } else if (network === "futurenet") {
          friendbotUrl = "https://friendbot-futurenet.stellar.org"
        } else {
          throw createStellarError(
            "VALIDATION_ERROR",
            `Friendbot is not supported on the ${network} network.`
          )
        }

        const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(targetAddress)}`)

        if (!response.ok) {
          if (response.status === 400) {
            throw createStellarError("ALREADY_FUNDED", "Account already exists and is funded.")
          }
          throw new Error(`Friendbot failed with status ${response.status}: ${response.statusText}`)
        }

        if (mounted.current) {
          setFunded(true)
        }
      } catch (e) {
        const stellarError = toStellarError(e)
        if (mounted.current) {
          setError(stellarError)
        }
        throw stellarError
      } finally {
        if (mounted.current) {
          setLoading(false)
        }
      }
    },
    [network, wallet.address]
  )

  return { fund, loading, error, funded }
}
