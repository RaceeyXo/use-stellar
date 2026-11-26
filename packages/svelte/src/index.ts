// packages/svelte/src/index.ts — Svelte 5 runes for the Stellar network.
//
// A scaffold: the runes land in follow-up issues. Everything here comes from
// the React-free `use-stellar/core` entry, so importing this package never
// loads React.

export { DEFAULT_STALE_TIME, DEFAULT_GC_TIME } from "use-stellar/core"
export type { QueryConfig } from "use-stellar/core"
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
