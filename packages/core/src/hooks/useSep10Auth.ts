// packages/core/src/hooks/useSep10Auth.ts

import { useState, useCallback, useEffect, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { useAnchor } from "./useAnchor"
import { isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"
import { WebAuth } from "@stellar/stellar-sdk"
import { createStellarError, toStellarError } from "../errors"
import type { UseSep10AuthOptions, UseSep10AuthReturn } from "../types"
import type { StellarError } from "../errors"

function decodeJwtExp(token: string): Date | null {
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(atob(payload))
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000)
    }
  } catch {
    // Ignore malformed JWT decoding errors; validation happens server-side
  }
  return null
}

const STORAGE_KEY_PREFIX = "sep10_jwt_"

export function useSep10Auth({
  homeDomain,
  account,
  memo,
  clientDomain,
  persist = false,
}: UseSep10AuthOptions): UseSep10AuthReturn {
  const { network, networkConfig, wallet } = useStellarContext()
  const { anchor, loading: anchorLoading, error: anchorError } = useAnchor({ homeDomain })

  const resolvedAccount = account || wallet.address
  const storageKey = `${STORAGE_KEY_PREFIX}${homeDomain}_${resolvedAccount}_${network}`

  const [token, setToken] = useState<string | null>(() => {
    if (persist && isBrowser() && resolvedAccount) {
      return localStorage.getItem(storageKey)
    }
    return null
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)

  // Clear token immediately on wallet disconnect or network change
  const lastWalletState = useRef({ address: wallet.address, network })
  useEffect(() => {
    if (
      lastWalletState.current.address !== wallet.address ||
      lastWalletState.current.network !== network
    ) {
      setToken(null)
      if (persist && isBrowser()) {
        localStorage.removeItem(storageKey)
      }
      lastWalletState.current = { address: wallet.address, network }
    }
  }, [wallet.address, network, persist, storageKey])

  const authenticate = useCallback(async () => {
    if (!isBrowser()) return Promise.reject(new Error("SSR not supported"))
    setLoading(true)
    setError(null)
    try {
      if (!wallet.connected || !wallet.address || !wallet.wallet) {
        throw createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected")
      }
      if (wallet.walletNetwork && wallet.walletNetwork !== network) {
        throw createStellarError("WRONG_NETWORK", "Network mismatch")
      }
      if (anchorError) throw anchorError
      if (!anchor) {
        throw new Error("Anchor configuration not loaded yet")
      }
      if (!anchor.webAuthEndpoint) {
        throw createStellarError("VALIDATION_ERROR", "Anchor does not specify a WEB_AUTH_ENDPOINT")
      }
      if (!anchor.signingKey) {
        throw createStellarError("VALIDATION_ERROR", "Anchor does not specify a SIGNING_KEY")
      }

      const clientAddress = resolvedAccount
      if (!clientAddress) {
        throw createStellarError("VALIDATION_ERROR", "No account resolved for authentication")
      }

      // Step 1: Fetch Challenge
      const url = new URL(anchor.webAuthEndpoint)
      url.searchParams.set("account", clientAddress)
      url.searchParams.set("home_domain", homeDomain)
      if (memo) url.searchParams.set("memo", memo)
      if (clientDomain) url.searchParams.set("client_domain", clientDomain)

      const challengeRes = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
      if (!challengeRes.ok) {
        throw new Error(`Failed to fetch challenge: ${challengeRes.statusText}`)
      }
      const challengeData = await challengeRes.json()
      const challengeXdr = challengeData.transaction

      if (!challengeXdr) {
        throw createStellarError(
          "SEP10_VALIDATION_FAILED",
          "Invalid challenge response: missing transaction"
        )
      }

      // Step 2: Validate Challenge (DO THIS BEFORE SIGNING)
      let clientAccountID: string
      try {
        const validationResult = WebAuth.readChallengeTx(
          challengeXdr,
          anchor.signingKey, // Sourced from stellar.toml, NOT the challenge itself
          networkConfig.networkPassphrase,
          homeDomain,
          new URL(anchor.webAuthEndpoint).hostname
        )
        clientAccountID = validationResult.clientAccountID
      } catch (e) {
        throw createStellarError(
          "SEP10_VALIDATION_FAILED",
          `Challenge validation failed: ${e instanceof Error ? e.message : String(e)}`
        )
      }

      if (clientAccountID !== clientAddress) {
        throw createStellarError(
          "SEP10_VALIDATION_FAILED",
          "Challenge validation failed: client account ID mismatch"
        )
      }

      // Step 3: Sign Challenge
      const adapter = getWalletAdapter(wallet.wallet)
      if (!adapter) {
        throw createStellarError("WALLET_UNSUPPORTED", `Wallet adapter not found: ${wallet.wallet}`)
      }

      let signedXdr: string
      try {
        signedXdr = await adapter.signTransaction(challengeXdr, {
          address: wallet.address,
          network: networkConfig.network,
          networkPassphrase: networkConfig.networkPassphrase,
        })
      } catch {
        throw createStellarError(
          "WALLET_REQUEST_REJECTED",
          "The user rejected the request in their wallet."
        )
      }

      // Step 4: Submit Signed Challenge
      const submitRes = await fetch(anchor.webAuthEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: signedXdr }),
      })

      if (!submitRes.ok) {
        throw new Error(`Failed to submit challenge: ${submitRes.statusText}`)
      }

      const submitData = await submitRes.json()
      const jwt = submitData.token

      if (!jwt) {
        throw new Error("Invalid response: missing JWT token")
      }

      setToken(jwt)
      if (persist && isBrowser()) {
        localStorage.setItem(storageKey, jwt)
      }

      return jwt
    } catch (e) {
      const stellarErr = toStellarError(e)
      setError(stellarErr)
      throw stellarErr
    } finally {
      setLoading(false)
    }
  }, [
    wallet,
    network,
    networkConfig,
    anchor,
    anchorError,
    resolvedAccount,
    homeDomain,
    memo,
    clientDomain,
    persist,
    storageKey,
  ])

  const logout = useCallback(() => {
    setToken(null)
    if (persist && isBrowser()) {
      localStorage.removeItem(storageKey)
    }
  }, [persist, storageKey])

  const expiresAt = token ? decodeJwtExp(token) : null
  const authenticated = !!token && (!expiresAt || expiresAt > new Date())

  return {
    token: authenticated ? token : null,
    expiresAt,
    authenticated,
    loading: loading || anchorLoading,
    error,
    authenticate,
    logout,
  }
}
