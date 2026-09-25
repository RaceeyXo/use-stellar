/**
 * Runtime capability checks for the Stellar SDK on React Native.
 *
 * Call this in your provider or app startup (development only) to get
 * actionable errors instead of cryptic failures deep in XDR encoding.
 */

export interface RuntimeCheckResult {
  passed: boolean
  missing: MissingPolyfill[]
}

export interface MissingPolyfill {
  global: string
  description: string
  fix: string
}

/**
 * Check all globals required by @stellar/stellar-sdk on Hermes.
 * Returns list of missing polyfills with actionable fix instructions.
 */
export function checkStellarRuntime(): RuntimeCheckResult {
  const missing: MissingPolyfill[] = []

  // Check Buffer

  if (typeof global.Buffer === "undefined") {
    missing.push({
      global: "Buffer",
      description: "Required for XDR encoding and transaction building",
      fix: 'Add `npm install buffer` and import `@use-stellar/react-native/polyfills` at the top of your app entry point.',
    })
  }

  // Check crypto.getRandomValues

  if (typeof global.crypto === "undefined" || typeof global.crypto.getRandomValues === "undefined") {
    missing.push({
      global: "crypto.getRandomValues",
      description:
        "Required for cryptographically secure random number generation (keypairs, transaction hashing)",
      fix: 'Add `npm install react-native-get-random-values` and import `@use-stellar/react-native/polyfills` at the top of your app entry point.',
    })
  }

  // Check URL

  if (typeof global.URL === "undefined") {
    missing.push({
      global: "URL",
      description: "Required for Horizon API URL construction",
      fix: 'Add `npm install react-native-url-polyfill` and import `@use-stellar/react-native/polyfills` at the top of your app entry point.',
    })
  }

  // Check TextEncoder

  if (typeof global.TextEncoder === "undefined") {
    missing.push({
      global: "TextEncoder",
      description: "Required for string encoding in XDR operations",
      fix: 'Add `npm install text-encoding` and import `@use-stellar/react-native/polyfills` at the top of your app entry point.',
    })
  }

  return {
    passed: missing.length === 0,
    missing,
  }
}

/**
 * Assert all required Stellar SDK globals are present.
 * Throws an actionable error in development if any are missing.
 * No-op in production to avoid performance overhead.
 *
 * Call this in your StellarProvider or app startup.
 */
export function assertStellarRuntime(): void {
  if (process.env.NODE_ENV === "production") return

  const result = checkStellarRuntime()

  if (result.passed) return

  const missingList = result.missing
    .map(m => `\n  ❌ ${m.global}\n     ${m.description}\n     Fix: ${m.fix}`)
    .join("")

  throw new Error(
    `[use-stellar] Missing required polyfills for Stellar SDK on React Native:${missingList}\n\n` +
      `Quick fix: Add this import to the TOP of your app entry point (before any other imports):\n` +
      `import '@use-stellar/react-native/polyfills'\n\n` +
      `See: https://github.com/RaceeyXo/use-stellar/packages/react-native#polyfills`,
  )
}
