// packages/core/src/hooks/useFriendbot.ts

import { useState, useCallback, useRef, useEffect } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { StrKey } from "@stellar/stellar-sdk"
import { toStellarError } from "../errors"
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

  const fund = useCallback(async (address?: string) => {
    setLoading(true)
    setError(null)
    setFunded(false)

    try {
      if (network === "mainnet") {
        const err = new Error("Friendbot is not available on mainnet.")
        err.name = "VALIDATION_ERROR"
        throw err
      }

      const targetAddress = address ?? wallet.address
      if (!targetAddress) {
        const err = new Error("No address provided and wallet is not connected.")
        err.name = "WALLET_NOT_CONNECTED"
        throw err
      }

      if (!StrKey.isValidEd25519PublicKey(targetAddress)) {
        const err = new Error("Invalid destination address. Must be a valid Ed25519 public key (starts with G).")
        err.name = "VALIDATION_ERROR"
        throw err
      }

      let friendbotUrl = ""
      if (network === "testnet") {
        friendbotUrl = "https://friendbot.stellar.org"
      } else if (network === "futurenet") {
        friendbotUrl = "https://friendbot-futurenet.stellar.org"
      } else {
        const err = new Error(`Friendbot is not supported on the ${network} network.`)
        err.name = "VALIDATION_ERROR"
        throw err
      }

      const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(targetAddress)}`)

      if (!response.ok) {
        if (response.status === 400) {
          const err = new Error("Account already exists and is funded.")
          err.name = "ALREADY_FUNDED"
          throw err
        }
        throw new Error(`Friendbot failed with status ${response.status}: ${response.statusText}`)
      }

      if (mounted.current) {
        setFunded(true)
      }
    } catch (e: any) {
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
  }, [network, wallet.address])

  return { fund, loading, error, funded }
}