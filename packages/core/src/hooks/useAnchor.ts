import { useState, useEffect, useCallback, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { isBrowser, isReactNative } from "../utils"
import { toStellarError } from "../errors"
import { fetchAnchorInfo } from "../queries/anchor"
import type { UseAnchorOptions, UseAnchorReturn, AnchorInfo } from "../types"

/**
 * Resolves an anchor's stellar.toml (SEP-1) and returns structured information
 * about the anchor including signing keys, endpoints, and supported currencies.
 *
 * **IMPORTANT**: On mainnet, only HTTPS domains are allowed. HTTP is only
 * permitted for local/standalone networks. Fetching an anchor's signing key
 * over plaintext HTTP allows a network attacker to choose the key you will
 * later validate a SEP-10 challenge against, defeating the authentication flow.
 *
 * @param options - Configuration options
 * @param options.homeDomain - The anchor's home domain (e.g., "testanchor.stellar.org")
 * @param options.autoFetch - Whether to automatically fetch on mount (default: true)
 * @returns `{ anchor, loading, error, refetch }`
 *
 * @example
 * const { anchor, loading } = useAnchor({ homeDomain: "testanchor.stellar.org" })
 * if (anchor) {
 *   console.log("Web auth endpoint:", anchor.webAuthEndpoint)
 *   console.log("Signing key:", anchor.signingKey)
 * }
 *
 * @example
 * // Manual fetch
 * const { anchor, refetch } = useAnchor({ homeDomain: "example.com", autoFetch: false })
 * // Later...
 * refetch()
 */
export function useAnchor({
  homeDomain,
  autoFetch = true,
}: UseAnchorOptions = {}): UseAnchorReturn {
  const { network } = useStellarContext()

  const [anchor, setAnchor] = useState<AnchorInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<UseAnchorReturn["error"]>(null)

  const requestRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchAnchor = useCallback(async () => {
    // SSR guard: no-op on server. React Native has no `window` but can fetch
    // stellar.toml like a browser, so it is not treated as a server.
    if (!isBrowser() && !isReactNative()) {
      return
    }

    if (!homeDomain || !homeDomain.trim()) {
      setAnchor(null)
      setError(null)
      setLoading(false)
      return
    }

    // Cancel any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const fetchId = ++requestRef.current
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const anchorInfo = await fetchAnchorInfo(homeDomain, network, { signal: controller.signal })

      if (fetchId !== requestRef.current) return

      setAnchor(anchorInfo)
      setError(null)
    } catch (err) {
      if (fetchId !== requestRef.current) return

      const stellarError = toStellarError(err)
      if (stellarError) {
        setAnchor(null)
        setError(stellarError)
      }
    } finally {
      if (fetchId === requestRef.current) {
        setLoading(false)
        abortControllerRef.current = null
      }
    }
  }, [homeDomain, network])

  useEffect(() => {
    if (autoFetch) {
      fetchAnchor()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      requestRef.current = -1
    }
  }, [fetchAnchor, autoFetch])

  return { anchor, loading, error, refetch: fetchAnchor }
}
