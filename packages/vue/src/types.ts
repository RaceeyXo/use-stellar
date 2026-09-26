// packages/vue/src/types.ts
//
// A small, self-contained type set for the Vue adapter. Deliberately not
// imported from the `use-stellar` (React) package: that package declares
// `react` as a required peer dependency, and pulling any part of it in here
// would put a React peer-dependency warning in front of every Vue user who
// installs this package — the exact installation friction `rn-03` fixed for
// React Native. Custom networks aren't supported yet; only the three SDF
// defaults are.

export type StellarNetwork = "testnet" | "mainnet" | "futurenet"

export interface NetworkConfig {
  network: StellarNetwork
  horizonUrl: string
  sorobanUrl: string
  networkPassphrase: string
}

export type Asset = "XLM" | { code: string; issuer: string }

export type Balance =
  | { asset: "XLM"; balance: string }
  | { asset: { code: string; issuer: string }; balance: string; limit?: string }
  | { asset: "liquidity_pool_shares"; balance: string; liquidityPoolId: string }

const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
}

export const NETWORK_CONFIGS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  },
  mainnet: {
    network: "mainnet",
    horizonUrl: "https://horizon.stellar.org",
    sorobanUrl: "https://soroban.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.mainnet,
  },
  futurenet: {
    network: "futurenet",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    sorobanUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.futurenet,
  },
}
