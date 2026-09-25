/**
 * @use-stellar/react-native
 *
 * React Native integration package for use-stellar.
 * Re-exports all public hooks and types from `use-stellar` so React Native
 * apps import from a single package.
 *
 * Native integrations (AppState, NetInfo, AsyncStorage wiring, mobile wallet
 * connection) are added in subsequent issues — this is the scaffold only.
 *
 * @example
 * ```tsx
 * import { useStellarAccount, StellarProvider } from '@use-stellar/react-native';
 * ```
 */

// Re-export all public hooks and types from use-stellar
// Do not fork or re-implement anything — thin re-export only
export * from "use-stellar"

// Placeholder for future React Native-specific exports
// (AppState provider, NetInfo hooks, AsyncStorage adapter, etc.)
// These will be added when native integration issues are implemented.
