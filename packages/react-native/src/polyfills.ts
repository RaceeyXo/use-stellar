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
 * - Buffer (from 'buffer' package)
 * - crypto.getRandomValues (from 'react-native-get-random-values')
 * - URL (from 'react-native-url-polyfill')
 * - TextEncoder / TextDecoder (from 'text-encoding' if missing)
 */

// ── Buffer ────────────────────────────────────────────────────────────

// Required by Stellar SDK for XDR encoding and transaction building

if (typeof global.Buffer === "undefined") {
  // Only install if missing — never overwrite existing implementation
  const { Buffer } = require("buffer")

  global.Buffer = Buffer
}

// ── crypto.getRandomValues ─────────────────────────────────────────────

// Required for transaction hashing and keypair generation

// MUST use a cryptographically secure implementation

// react-native-get-random-values uses native crypto — safe for production

if (typeof global.crypto === "undefined" || typeof global.crypto.getRandomValues === "undefined") {
  require("react-native-get-random-values")
}

// ── URL ───────────────────────────────────────────────────────────────

// Required for Horizon API URL construction

if (typeof global.URL === "undefined") {
  require("react-native-url-polyfill/auto")
}

// ── TextEncoder / TextDecoder ─────────────────────────────────────────

// Required for string encoding in XDR operations

if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("text-encoding")

  global.TextEncoder = TextEncoder

  global.TextDecoder = TextDecoder
}

export {} // mark as module
