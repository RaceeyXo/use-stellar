import { WebAuth } from "@stellar/stellar-sdk"
import { fetchAnchorInfo } from "../queries/anchor"
import { createStellarError, toStellarError } from "../errors"
import { getWalletAdapter } from "../wallets"
import type { AnchorInfo, NetworkConfig, StellarNetwork, WalletState } from "../types"

export interface Sep10AuthRuntime { network: StellarNetwork; networkConfig: NetworkConfig; wallet: WalletState }
export interface Sep10AuthOptions { homeDomain: string; account?: string; memo?: string; clientDomain?: string; anchor?: AnchorInfo }

export function decodeSep10Expiry(token: string): Date | null {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    if (typeof atob !== "function") return null
    const decoded = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))
    const payload = JSON.parse(decoded) as { exp?: number }
    return payload.exp ? new Date(payload.exp * 1000) : null
  } catch { return null }
}

export async function authenticateSep10(runtime: Sep10AuthRuntime, options: Sep10AuthOptions): Promise<string> {
  const { wallet, network, networkConfig } = runtime
  if (!wallet.connected || !wallet.address || !wallet.wallet) throw createStellarError("WALLET_NOT_CONNECTED", "Wallet not connected")
  if (wallet.walletNetwork && wallet.walletNetwork !== network) throw createStellarError("WRONG_NETWORK", "Network mismatch")
  const anchor = options.anchor ?? await fetchAnchorInfo(options.homeDomain, network)
  if (!anchor.webAuthEndpoint) throw createStellarError("VALIDATION_ERROR", "Anchor does not specify a WEB_AUTH_ENDPOINT")
  if (!anchor.signingKey) throw createStellarError("VALIDATION_ERROR", "Anchor does not specify a SIGNING_KEY")
  const account = options.account || wallet.address

  try {
    const challengeUrl = new URL(anchor.webAuthEndpoint)
    challengeUrl.searchParams.set("account", account)
    challengeUrl.searchParams.set("home_domain", options.homeDomain)
    if (options.memo) challengeUrl.searchParams.set("memo", options.memo)
    if (options.clientDomain) challengeUrl.searchParams.set("client_domain", options.clientDomain)
    const challengeResponse = await fetch(challengeUrl, { headers: { "Content-Type": "application/json" } })
    if (!challengeResponse.ok) throw new Error(`Failed to fetch challenge: ${challengeResponse.statusText}`)
    const challengeXdr = (await challengeResponse.json() as { transaction?: string }).transaction
    if (!challengeXdr) throw createStellarError("SEP10_VALIDATION_FAILED", "Invalid challenge response: missing transaction")

    let validation: ReturnType<typeof WebAuth.readChallengeTx>
    try {
      validation = WebAuth.readChallengeTx(challengeXdr, anchor.signingKey, networkConfig.networkPassphrase, options.homeDomain, challengeUrl.hostname)
    } catch (cause) {
      throw createStellarError("SEP10_VALIDATION_FAILED", `Challenge validation failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    if (validation.clientAccountID !== account) throw createStellarError("SEP10_VALIDATION_FAILED", "Challenge validation failed: client account ID mismatch")
    const expiresAt = Number((validation as unknown as { tx?: { timeBounds?: { maxTime?: string } } }).tx?.timeBounds?.maxTime ?? 0)

    let signedXdr: string
    try {
      signedXdr = await getWalletAdapter(wallet.wallet).signTransaction(challengeXdr, { address: wallet.address, network, networkPassphrase: networkConfig.networkPassphrase })
    } catch {
      throw createStellarError("WALLET_REQUEST_REJECTED", "The user rejected the request in their wallet.")
    }
    if (expiresAt > 0 && Math.floor(Date.now() / 1000) >= expiresAt) {
      throw createStellarError("SEP10_VALIDATION_FAILED", "The SEP-10 challenge expired while waiting for the wallet signature. Retry authentication.")
    }

    const submit = await fetch(anchor.webAuthEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction: signedXdr }) })
    if (!submit.ok) throw new Error(`Failed to submit challenge: ${submit.statusText}`)
    const token = (await submit.json() as { token?: string }).token
    if (!token) throw new Error("Invalid response: missing JWT token")
    return token
  } catch (cause) {
    const error = toStellarError(cause)
    if (error?.code === "UNKNOWN_ERROR" && cause instanceof Error && cause.message.includes("challenge")) {
      throw createStellarError("SEP10_VALIDATION_FAILED", cause.message)
    }
    throw error ?? cause
  }
}
