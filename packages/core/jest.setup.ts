import { registerWalletAdapter } from "./src/wallets/registry"
import { freighterAdapter } from "./src/wallets/freighterAdapter"
import { albedoAdapter } from "./src/wallets/albedoAdapter"
import { rabetAdapter } from "./src/wallets/rabetAdapter"

// Mirrors what the web entry (`src/index.ts`) registers, for tests that import
// hooks and the registry directly rather than through that entry.

registerWalletAdapter(freighterAdapter)
registerWalletAdapter(albedoAdapter)
registerWalletAdapter(rabetAdapter)
