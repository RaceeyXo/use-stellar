// packages/vue/src/types.ts
//
// Network and asset types come from `use-stellar/core`, the React-free entry,
// so Vue and React share one declaration. Re-exported here so existing imports
// from `@use-stellar/vue` keep working.

import type { StellarNetwork as CoreStellarNetwork } from "use-stellar/core"

export { NETWORK_CONFIGS } from "use-stellar/core"
export type { NetworkConfig, Asset, Balance } from "use-stellar/core"

/**
 * The networks the Vue adapter supports. Core also models `"custom"`, which
 * the plugin does not support yet (only the three SDF defaults are).
 */
export type StellarNetwork = Exclude<CoreStellarNetwork, "custom">
