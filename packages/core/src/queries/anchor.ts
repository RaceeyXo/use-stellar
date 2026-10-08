import { StellarToml } from "@stellar/stellar-sdk"
import { isValidStellarAddress } from "../utils"
import { createStellarError, toStellarError } from "../errors"
import type { AnchorCurrency, AnchorInfo, StellarNetwork } from "../types"

/**
 * Timeout for stellar.toml fetch (10 seconds).
 * Note: The Stellar SDK's resolver handles size limits internally per SEP-1 (100 KB max).
 */
export const TOML_FETCH_TIMEOUT = 10_000

export interface FetchAnchorInfoOptions {
  signal?: AbortSignal
  timeout?: number
}

/**
 * Resolves an anchor's stellar.toml (SEP-1) and returns structured
 * information about the anchor including signing keys, endpoints, and
 * supported currencies.
 *
 * **IMPORTANT**: On mainnet, only HTTPS domains are allowed. HTTP is only
 * permitted for local/standalone networks. Fetching an anchor's signing key
 * over plaintext HTTP allows a network attacker to choose the key you will
 * later validate a SEP-10 challenge against, defeating the authentication
 * flow.
 *
 * Framework-neutral: no React/Vue imports, no cache access. Errors are
 * mapped through `toStellarError` so both frameworks surface identical
 * codes.
 */
export async function fetchAnchorInfo(
  homeDomain: string,
  network: StellarNetwork,
  { signal, timeout = TOML_FETCH_TIMEOUT }: FetchAnchorInfoOptions = {}
): Promise<AnchorInfo> {
  const normalizedDomain = homeDomain.trim().toLowerCase()

  if (!normalizedDomain) {
    throw createStellarError("VALIDATION_ERROR", "useAnchor: `homeDomain` must not be empty.")
  }

  try {
    const allowHttp =
      network === "custom" ||
      network === "testnet" ||
      network === "futurenet" ||
      normalizedDomain.includes("localhost") ||
      normalizedDomain.startsWith("127.") ||
      normalizedDomain.startsWith("192.168.")

    if (!allowHttp && network === "mainnet" && normalizedDomain.startsWith("http://")) {
      throw createStellarError(
        "VALIDATION_ERROR",
        "HTTP is not allowed for anchors on mainnet. Use HTTPS to prevent man-in-the-middle attacks."
      )
    }

    const controller = new AbortController()
    const externalAbort = () => controller.abort()
    signal?.addEventListener("abort", externalAbort)

    // Settles on timeout or abort, whichever comes first. The SDK's resolver
    // takes no AbortSignal, so aborting cannot cancel its HTTP request — but it
    // does settle this call immediately, so a superseded or unmounted lookup
    // releases its timer and closure instead of waiting on the network.
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const cutoffPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          createStellarError("NETWORK_ERROR", `stellar.toml fetch timed out after ${timeout}ms`)
        )
        controller.abort()
      }, timeout)
      controller.signal.addEventListener("abort", () => {
        clearTimeout(timeoutId)
        reject(createStellarError("NETWORK_ERROR", "stellar.toml fetch was aborted"))
      })
    })

    let toml: Record<string, unknown>
    try {
      const resolvePromise = StellarToml.Resolver.resolve(normalizedDomain, {
        allowHttp,
        timeout,
      })
      toml = (await Promise.race([resolvePromise, cutoffPromise])) as Record<string, unknown>
    } finally {
      clearTimeout(timeoutId)
      signal?.removeEventListener("abort", externalAbort)
    }

    const signingKey =
      typeof toml.SIGNING_KEY === "string" && toml.SIGNING_KEY.trim()
        ? toml.SIGNING_KEY.trim()
        : null

    if (signingKey && !isValidStellarAddress(signingKey)) {
      throw createStellarError(
        "VALIDATION_ERROR",
        `Invalid signing key in stellar.toml: "${signingKey}" is not a valid Stellar public key (must start with G and be 56 characters).`
      )
    }

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
      typeof toml.KYC_SERVER === "string" && toml.KYC_SERVER.trim() ? toml.KYC_SERVER.trim() : null

    const currencies: AnchorCurrency[] = []
    if (Array.isArray(toml.CURRENCIES)) {
      for (const curr of toml.CURRENCIES) {
        if (curr && typeof curr === "object") {
          const code = typeof curr.code === "string" ? curr.code.trim() : ""
          if (!code) continue

          const issuer =
            typeof curr.issuer === "string" && curr.issuer.trim() ? curr.issuer.trim() : null

          if (issuer && !isValidStellarAddress(issuer)) {
            // Skip invalid issuers rather than failing the entire fetch.
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

    return {
      homeDomain: normalizedDomain,
      signingKey,
      webAuthEndpoint,
      transferServer,
      transferServerSep24,
      kycServer,
      currencies,
      raw: toml,
    }
  } catch (err) {
    if (signal?.aborted) throw err
    const stellarError = toStellarError(err)
    throw stellarError ?? err
  }
}
