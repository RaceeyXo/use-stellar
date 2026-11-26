// Links into the testnet block explorer. The demo is testnet only.
const EXPLORER = "https://stellar.expert/explorer/testnet"

export const txUrl = (hash: string): string => `${EXPLORER}/tx/${hash}`
export const accountUrl = (address: string): string => `${EXPLORER}/account/${address}`

/** `GABC…WXYZ`, for an address or a hash too long to read anyway. */
export function short(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`
}

/** `XLM`, or `USDC` for an issued asset. */
export function assetCode(asset: "XLM" | { code: string; issuer: string } | string): string {
  return typeof asset === "string" ? asset : asset.code
}
