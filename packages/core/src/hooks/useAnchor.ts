import { useState, useEffect, useCallback, useRef } from "react"
import { StellarToml } from "@stellar/stellar-sdk"
import { useStellarContext } from "../context/StellarProvider"
import { isBrowser, isValidStellarAddress } from "../utils"
import { createStellarError, toStellarError } from "../errors"
import type { UseAnchorOptions, UseAnchorReturn, AnchorInfo, AnchorCurrency } from "../types"

/**
 * Timeout for stellar.toml fetch (10 seconds).
 * Note: The Stellar SDK's resolver handles size limits internally per SEP-1 (100 KB max).
 */
const TOML_FETCH_TIMEOUT = 10_000

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
    // SSR guard: no-op on server
    if (!isBrowser()) {
      return
    }

    if (!homeDomain) {
      setAnchor(null)
      setError(null)
      setLoading(false)
      return
    }

    const normalizedDomain = homeDomain.trim().toLowerCase()

    if (!normalizedDomain) {
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
      // Enforce HTTPS on mainnet
      const allowHttp =
        network === "custom" ||
        network === "testnet" ||
        network === "futurenet" ||
        normalizedDomain.includes("localhost") ||
        normalizedDomain.startsWith("127.") ||
        normalizedDomain.startsWith("192.168.")

      if (!allowHttp && network === "mainnet") {
        // Double-check that we're not allowing HTTP on mainnet
        const testUrl = normalizedDomain.startsWith("http://")
        if (testUrl) {
          throw createStellarError(
            "VALIDATION_ERROR",
            "HTTP is not allowed for anchors on mainnet. Use HTTPS to prevent man-in-the-middle attacks."
          )
        }
      }

      // Fetch with timeout and size limit
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          controller.abort()
          reject(
            createStellarError(
              "NETWORK_ERROR",
              `stellar.toml fetch timed out after ${TOML_FETCH_TIMEOUT}ms`
            )
          )
        }, TOML_FETCH_TIMEOUT)

        // Clean up timeout if request completes
        controller.signal.addEventListener("abort", () => clearTimeout(timeoutId))
      })

      const resolvePromise = StellarToml.Resolver.resolve(normalizedDomain, {
        allowHttp,
        timeout: TOML_FETCH_TIMEOUT,
      })

      const toml = await Promise.race([resolvePromise, timeoutPromise])

      if (fetchId !== requestRef.current) return

      // Validate and normalize the response
      const signingKey =
        typeof toml.SIGNING_KEY === "string" && toml.SIGNING_KEY.trim()
          ? toml.SIGNING_KEY.trim()
          : null

      // Validate signing key is a real Stellar public key
      if (signingKey && !isValidStellarAddress(signingKey)) {
        throw createStellarError(
          "VALIDATION_ERROR",
          `Invalid signing key in stellar.toml: "${signingKey}" is not a valid Stellar public key (must start with G and be 56 characters).`
        )
      }

      // Extract endpoints (all optional)
      const webAuthEndpoint =
        typeof toml.WEB_AUTH_ENDPOINT === "string" && toml.WEB_AUTH_ENDPOINT.trim()
          ? toml.WEB_AUTH_ENDPOINT.trim()
          : null

      const transferServer =
        typeof toml.TRANSFER_SERVER === "string" && toml.TRANSFER_SERVER.trim()
          ? toml.TRANSFER_SERVER.trim()
          : null

      const transferServerSep24 =
        typeof toml.TRANSFER_SERVER_SEP0024 === "string" && toml.TRANSFER_SERVER_SEP0024.trim()
          ? toml.TRANSFER_SERVER_SEP0024.trim()
          : null

      const kycServer =
        typeof toml.KYC_SERVER === "string" && toml.KYC_SERVER.trim()
          ? toml.KYC_SERVER.trim()
          : null

      // Parse currencies
      const currencies: AnchorCurrency[] = []
      if (Array.isArray(toml.CURRENCIES)) {
        for (const curr of toml.CURRENCIES) {
          if (curr && typeof curr === "object") {
            const code = typeof curr.code === "string" ? curr.code.trim() : ""
            if (!code) continue

            const issuer =
              typeof curr.issuer === "string" && curr.issuer.trim() ? curr.issuer.trim() : null

            // Validate issuer if present
            if (issuer && !isValidStellarAddress(issuer)) {
              // Skip invalid issuers rather than failing the entire fetch
              continue
            }

            currencies.push({
              code,
              issuer,
              name: typeof curr.name === "string" ? curr.name : undefined,
              desc: typeof curr.desc === "string" ? curr.desc : undefined,
              image: typeof curr.image === "string" ? curr.image : undefined,
              isAssetAnchored:
                typeof curr.is_asset_anchored === "boolean" ? curr.is_asset_anchored : undefined,
            })
          }
        }
      }

      const anchorInfo: AnchorInfo = {
        homeDomain: normalizedDomain,
        signingKey,
        webAuthEndpoint,
        transferServer,
        transferServerSep24,
        kycServer,
        currencies,
        raw: toml as Record<string, unknown>,
      }

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
