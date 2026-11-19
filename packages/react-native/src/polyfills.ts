/**
 * Stellar SDK polyfills for React Native / Hermes.
 *
 * Import this ONCE at the top of your app entry point:
 *   import '@use-stellar/react-native/polyfills'
 *
 * This file is intentionally separate from the main entry so apps opt in explicitly.
 * The main entry (@use-stellar/react-native) NEVER imports this file.
 *
 * Polyfills installed:
 * - crypto.getRandomValues (from 'react-native-get-random-values')
 * - Buffer (from 'buffer' package)
 * - URL / URLSearchParams (from 'react-native-url-polyfill')
 * - TextEncoder / TextDecoder (from 'text-encoding' if missing)
 */

// ── crypto.getRandomValues ─────────────────────────────────────────────
// Required for transaction hashing and keypair generation, and installed
// first: anything loaded after this may capture `crypto` at import time.
//
// MUST use a cryptographically secure implementation.
// react-native-get-random-values uses native crypto — safe for production.

if (typeof global.crypto === "undefined" || typeof global.crypto.getRandomValues === "undefined") {
  require("react-native-get-random-values")
}

// ── Buffer ────────────────────────────────────────────────────────────
// Required by Stellar SDK for XDR encoding and transaction building

if (typeof global.Buffer === "undefined") {
  // Only install if missing — never overwrite existing implementation
  const { Buffer } = require("buffer")

  global.Buffer = Buffer
}

// ── URL / URLSearchParams ─────────────────────────────────────────────
// Required for Horizon API URL construction.
//
// React Native ships a `URL` global of its own, but most of it throws
// "not implemented" (`searchParams.get`, `hostname`, …). So the test is whether
// URL *works*, not whether it exists.

function hasWorkingUrl(): boolean {
  try {
    return new URL("https://example.org/path?key=value").searchParams.get("key") === "value"
  } catch {
    return false
  }
}

if (!hasWorkingUrl()) {
  require("react-native-url-polyfill/auto")
}

// ── TextEncoder / TextDecoder ─────────────────────────────────────────
// Required for string encoding in XDR operations. Checked separately: some
// runtimes ship the encoder without the decoder.

if (typeof global.TextEncoder === "undefined" || typeof global.TextDecoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("text-encoding")

  if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder
  if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder
}

export {} // mark as module
