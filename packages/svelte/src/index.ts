/**
 * Svelte entry for @use-stellar/svelte.
 * The package does not import React. Runes-based stores land with the
 * adapter; this module is the published surface CI builds, tests, and packs.
 */
export const STELLAR_SVELTE_NETWORK = "testnet" as const

export function createStellarSvelte(options?: { network?: "testnet" }): {
  network: "testnet"
} {
  return { network: options?.network ?? "testnet" }
}
