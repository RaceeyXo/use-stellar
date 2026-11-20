import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { useAnchor } from "./useAnchor"
import { authenticateSep10, decodeSep10Expiry } from "../actions/sep10Auth"
import { isBrowser } from "../utils"
import { toStellarError, type StellarError } from "../errors"
import type { UseSep10AuthOptions, UseSep10AuthReturn } from "../types"

const STORAGE_KEY_PREFIX = "sep10_jwt_"

export function useSep10Auth({ homeDomain, account, memo, clientDomain, persist = false }: UseSep10AuthOptions): UseSep10AuthReturn {
  const runtime = useStellarContext()
  const { anchor, loading: anchorLoading, error: anchorError } = useAnchor({ homeDomain })
  const resolvedAccount = account || runtime.wallet.address
  const storageKey = `${STORAGE_KEY_PREFIX}${homeDomain}_${resolvedAccount}_${runtime.network}`
  const [token, setToken] = useState<string | null>(() => persist && isBrowser() && resolvedAccount ? localStorage.getItem(storageKey) : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StellarError | null>(null)
  const operation = useRef(0)
  const identity = useRef({ address: runtime.wallet.address, network: runtime.network })

  useEffect(() => {
    if (identity.current.address === runtime.wallet.address && identity.current.network === runtime.network) return
    identity.current = { address: runtime.wallet.address, network: runtime.network }
    setToken(null); setError(null); operation.current += 1
    if (persist && isBrowser()) localStorage.removeItem(storageKey)
  }, [runtime.wallet.address, runtime.network, persist, storageKey])

  const authenticate = useCallback(async () => {
    const id = ++operation.current
    setLoading(true); setError(null)
    try {
      if (anchorError) throw anchorError
      if (!anchor) throw new Error("Anchor configuration not loaded yet")
      const next = await authenticateSep10(runtime, { homeDomain, account: resolvedAccount ?? undefined, memo, clientDomain, anchor })
      if (id === operation.current) {
        setToken(next)
        if (persist && isBrowser()) localStorage.setItem(storageKey, next)
      }
      return next
    } catch (cause) {
      const next = toStellarError(cause)
      if (id === operation.current) setError(next)
      throw next
    } finally { if (id === operation.current) setLoading(false) }
  }, [runtime, anchor, anchorError, homeDomain, resolvedAccount, memo, clientDomain, persist, storageKey])

  const logout = useCallback(() => { operation.current += 1; setToken(null); setError(null); if (persist && isBrowser()) localStorage.removeItem(storageKey) }, [persist, storageKey])
  const expiresAt = useMemo(() => token ? decodeSep10Expiry(token) : null, [token])
  const authenticated = Boolean(token && (!expiresAt || expiresAt > new Date()))
  return { token: authenticated ? token : null, expiresAt, authenticated, loading: loading || anchorLoading, error, authenticate, logout }
}
